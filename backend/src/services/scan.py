"""Scan processing service."""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from src.models import ScanRecord, Operator, ProductionStage, WorkOrder, Product, ProductStage
from src.services.work_order import get_or_create_work_order
from src.services import quality as quality_service
from src.schemas.scan import ScanRequest, ScanResponse, WorkOrderStatusResponse
from datetime import datetime
import uuid
import asyncio


def process_scan(db: Session, scan_request: ScanRequest) -> ScanResponse:
    """
    Process barcode scan and create scan record.

    Args:
        db: Database session
        scan_request: Scan request with barcode, stage_id, operator_id

    Returns:
        ScanResponse: Scan result with scan_id, work_order details, and message

    Raises:
        HTTPException 404: If operator or stage not found
        HTTPException 409: If duplicate scan detected
        HTTPException 400: If work order creation fails

    Example:
        >>> response = process_scan(db, scan_request)
        >>> print(response.message)  # "Scan recorded successfully"
    """
    # Validate operator exists and is active
    operator = db.query(Operator).filter(
        Operator.id == scan_request.operator_id,
        Operator.is_active == True
    ).first()
    if not operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator {scan_request.operator_id} not found or inactive"
        )

    # Validate stage exists
    stage = db.query(ProductionStage).filter(
        ProductionStage.id == scan_request.stage_id
    ).first()
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production stage {scan_request.stage_id} not found"
        )

    # Enforce sequential stage order BEFORE creating work order
    # Check if this work order already exists
    existing_wo = db.query(WorkOrder).filter(
        WorkOrder.work_order_code == scan_request.barcode.strip().upper()
    ).first()

    # Determine product_id for product-specific stage ordering.
    # Prefer the operator's explicitly selected product (scan_request.product_id),
    # then fall back to the work order's stored product, then active product.
    if scan_request.product_id:
        product_id = scan_request.product_id
    elif existing_wo:
        product_id = existing_wo.product_id
    else:
        # Fall back to active product for backward compatibility
        active_product = db.query(Product).filter(Product.is_active == True).first()
        product_id = active_product.id if active_product else None

    if product_id:
        # Get current stage's product-specific sequence
        current_ps = db.query(ProductStage).filter(
            ProductStage.product_id == product_id,
            ProductStage.stage_id == scan_request.stage_id,
        ).first()
        current_seq = current_ps.sequence if current_ps else 0

        # Get all product stages with lower sequence (previous stages)
        previous_product_stages = (
            db.query(ProductStage, ProductionStage)
            .join(ProductionStage, ProductionStage.id == ProductStage.stage_id)
            .filter(
                ProductStage.product_id == product_id,
                ProductStage.sequence < current_seq,
            )
            .order_by(ProductStage.sequence)
            .all()
        )

        if not existing_wo:
            # New work order — must start at the first stage (lowest product sequence)
            if previous_product_stages:
                first_stage = previous_product_stages[0][1]
                missing_names = ", ".join(ps.stage_name for _, ps in previous_product_stages)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Work order must be scanned at stage {first_stage.stage_name} first. "
                           f"Missing previous stages: {missing_names}."
                )
        else:
            # Existing work order — check all previous product stages have OK scans
            for ps_assoc, ps_stage in previous_product_stages:
                ok_scan = db.query(ScanRecord).filter(
                    ScanRecord.work_order_id == existing_wo.id,
                    ScanRecord.stage_id == ps_assoc.stage_id,
                    ScanRecord.quality_status.in_(["ok", "ok_update"]),
                ).first()
                if not ok_scan:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Work order must complete stage {ps_stage.stage_name} (Stage {ps_assoc.sequence}) "
                               f"before scanning at {stage.stage_name} (Stage {current_seq})."
                    )

    # For NEW barcodes, pre-validate first article requirements BEFORE creating work order.
    # This prevents consuming a serial number for requests that will fail validation.
    # For existing work orders, the serial was already assigned — no gap risk.
    if not existing_wo and product_id:
        needs_first_article = quality_service.check_first_article_approval_required(
            db, product_id, scan_request.stage_id
        )
        if needs_first_article:
            if not scan_request.quality_inspector_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="First article inspection requires quality_inspector_id. "
                           "This is the first scan of this product at this stage and requires QI approval."
                )
            # Validate quality inspector early so we don't waste a serial on invalid QI
            quality_service.validate_quality_inspector(db, scan_request.quality_inspector_id)
        else:
            if not quality_service.check_first_article_approved(db, product_id, scan_request.stage_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot process scan: First article for this product at this stage "
                           "has not been approved yet. Please wait for QI approval."
                )

    # Get or create work order (serial number generated automatically)
    try:
        work_order = get_or_create_work_order(db, scan_request.barcode, product_id=scan_request.product_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    quality_status = scan_request.quality_status or "ok"

    # Check for duplicate scan at this stage BEFORE inserting.
    # Skip duplicate check when scanning for a different product than the WO's stored product —
    # the same barcode can be used across products, each starting from scan #1.
    if scan_request.product_id and work_order.product_id and str(work_order.product_id) != str(scan_request.product_id):
        existing_scan = None
    else:
        existing_scan = db.query(ScanRecord).filter(
            ScanRecord.work_order_id == work_order.id,
            ScanRecord.stage_id == scan_request.stage_id,
        ).first()

    if existing_scan:
        if quality_status in ("ok_update", "not_ok_update"):
            # User chose an update status — update existing scan
            existing_scan.quality_status = quality_status
            existing_scan.scan_timestamp = datetime.utcnow()
            db.commit()
            db.refresh(existing_scan)

            response = ScanResponse(
                scan_id=existing_scan.id,
                work_order_id=work_order.id,
                barcode=work_order.work_order_code,
                stage_name=stage.stage_name,
                stage_sequence=stage.stage_sequence,
                operator_name=operator.full_name,
                requires_first_article=False,
                quality_status=quality_status,
                scanned_at=existing_scan.scan_timestamp,
                message=f"Quality status updated to {quality_status.replace('_', ' ').upper()}"
            )

            # Broadcast update event via WebSocket
            try:
                from src.websocket.manager import manager
                supervisor_op = db.query(Operator).filter(Operator.id == existing_scan.supervisor_id).first() if existing_scan.supervisor_id else None
                qi_op = db.query(Operator).filter(Operator.id == existing_scan.quality_inspector_id).first() if existing_scan.quality_inspector_id else None
                asyncio.create_task(manager.broadcast({
                    "event_type": "scan_updated",
                    "payload": {
                        "id": str(existing_scan.id),
                        "work_order_id": str(work_order.id),
                        "work_order_code": work_order.work_order_code,
                        "serial_number": work_order.serial_number,
                        "stage_id": str(existing_scan.stage_id),
                        "stage_name": stage.stage_name,
                        "operator_id": str(existing_scan.operator_id),
                        "operator_name": operator.full_name,
                        "station_id": operator.station_id if operator else None,
                        "scan_type": existing_scan.scan_type,
                        "quality_status": quality_status,
                        "is_first_article": existing_scan.is_first_article,
                        "supervisor_id": str(existing_scan.supervisor_id) if existing_scan.supervisor_id else None,
                        "supervisor_name": supervisor_op.full_name if supervisor_op else None,
                        "quality_inspector_id": str(existing_scan.quality_inspector_id) if existing_scan.quality_inspector_id else None,
                        "quality_inspector_name": qi_op.full_name if qi_op else None,
                        "previous_quality_status": existing_scan.previous_quality_status,
                        "scan_timestamp": existing_scan.scan_timestamp.isoformat() + "Z" if existing_scan.scan_timestamp else None,
                        "created_at": existing_scan.created_at.isoformat() + "Z" if existing_scan.created_at else None,
                    },
                }))
            except Exception:
                pass

            return response
        else:
            # Duplicate with ok/not_ok — block it
            scan_time = (
                existing_scan.scan_timestamp.strftime("%d %b %Y, %I:%M %p")
                if existing_scan.scan_timestamp else "unknown time"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Work order '{work_order.work_order_code}' was already scanned at this stage on {scan_time}"
            )

    # Classify scan type (first_article, normal, or update)
    scan_type = quality_service.classify_scan_type(
        db,
        work_order.id,
        scan_request.stage_id,
        work_order.product_id
    )

    # Determine if this is first article
    first_article = (scan_type == "first_article")

    # For first article scans, require quality inspector approval
    quality_inspector = None
    if first_article:
        if not scan_request.quality_inspector_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First article inspection requires quality_inspector_id. "
                       "This is the first scan of this product at this stage and requires QI approval."
            )

        # Validate quality inspector
        quality_inspector = quality_service.validate_quality_inspector(
            db,
            scan_request.quality_inspector_id
        )

        message = f"First article approved by QI: {quality_inspector.full_name}"
    else:
        # Check if first article has been approved before allowing normal scans
        if not quality_service.check_first_article_approved(
            db,
            work_order.product_id,
            scan_request.stage_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot process scan: First article for this product at this stage "
                       "has not been approved yet. Please wait for QI approval."
            )

        message = "Scan recorded successfully"

    # Create scan record
    scan_record = ScanRecord(
        id=uuid.uuid4(),
        work_order_id=work_order.id,
        stage_id=scan_request.stage_id,
        operator_id=scan_request.operator_id,
        supervisor_id=scan_request.supervisor_id,
        scan_type=scan_type,
        is_first_article=first_article,
        quality_status=quality_status,
        quality_inspector_id=quality_inspector.id if quality_inspector else None,
        scan_timestamp=datetime.utcnow()
    )

    try:
        db.add(scan_record)

        # Update work order current stage
        work_order.current_stage_id = scan_request.stage_id
        work_order.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(scan_record)
        db.refresh(work_order)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Work order '{work_order.work_order_code}' is already scanned at this stage"
        )

    # Build response
    response = ScanResponse(
        scan_id=scan_record.id,
        work_order_id=work_order.id,
        barcode=work_order.work_order_code,
        stage_name=stage.stage_name,
        stage_sequence=stage.stage_sequence,
        operator_name=operator.full_name,
        requires_first_article=first_article,
        quality_status=quality_status,
        scanned_at=scan_record.scan_timestamp,
        message=message
    )

    # Broadcast scan event via WebSocket (non-blocking)
    try:
        from src.websocket.manager import manager
        supervisor_op = db.query(Operator).filter(Operator.id == scan_record.supervisor_id).first() if scan_record.supervisor_id else None
        qi_op = db.query(Operator).filter(Operator.id == scan_record.quality_inspector_id).first() if scan_record.quality_inspector_id else None
        asyncio.create_task(manager.broadcast({
            "event_type": "scan_created",
            "payload": {
                "id": str(scan_record.id),
                "work_order_id": str(work_order.id),
                "work_order_code": work_order.work_order_code,
                "serial_number": work_order.serial_number,
                "stage_id": str(scan_record.stage_id),
                "stage_name": stage.stage_name,
                "operator_id": str(scan_record.operator_id),
                "operator_name": operator.full_name,
                "station_id": operator.station_id if operator else None,
                "scan_type": scan_record.scan_type,
                "quality_status": quality_status,
                "is_first_article": first_article,
                "supervisor_id": str(scan_record.supervisor_id) if scan_record.supervisor_id else None,
                "supervisor_name": supervisor_op.full_name if supervisor_op else None,
                "quality_inspector_id": str(scan_record.quality_inspector_id) if scan_record.quality_inspector_id else None,
                "quality_inspector_name": qi_op.full_name if qi_op else None,
                "previous_quality_status": scan_record.previous_quality_status,
                "scan_timestamp": scan_record.scan_timestamp.isoformat() + "Z" if scan_record.scan_timestamp else None,
                "created_at": scan_record.created_at.isoformat() + "Z" if scan_record.created_at else None,
            },
        }))
    except Exception as e:
        # Don't fail the scan if WebSocket broadcast fails
        import logging
        logging.error(f"Failed to broadcast scan event: {e}")

    return response


def get_work_order_status(db: Session, barcode: str) -> WorkOrderStatusResponse:
    """
    Get work order status and progress.

    Args:
        db: Database session
        barcode: Work order barcode

    Returns:
        WorkOrderStatusResponse: Work order details and progress

    Raises:
        HTTPException 404: If work order not found

    Example:
        >>> status = get_work_order_status(db, "TREO-TRAND-12345-001")
        >>> print(status.completed_stages)  # ["Cutting", "Stripping"]
    """
    # Find work order
    work_order = db.query(WorkOrder).filter(WorkOrder.work_order_code == barcode).first()
    if not work_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order {barcode} not found"
        )

    # Get product details
    product = db.query(Product).filter(Product.id == work_order.product_id).first()

    # Get current stage
    current_stage = None
    current_stage_sequence = None
    if work_order.current_stage_id:
        stage = db.query(ProductionStage).filter(
            ProductionStage.id == work_order.current_stage_id
        ).first()
        if stage:
            current_stage = stage.stage_name
            current_stage_sequence = stage.stage_sequence

    # Get completed stages
    completed_scans = db.query(ScanRecord).filter(
        ScanRecord.work_order_id == work_order.id
    ).all()

    completed_stages = []
    for scan in completed_scans:
        stage = db.query(ProductionStage).filter(
            ProductionStage.id == scan.stage_id
        ).first()
        if stage:
            completed_stages.append(stage.stage_name)

    # Total stages (always 5)
    total_stages = 5

    return WorkOrderStatusResponse(
        work_order_id=work_order.id,
        barcode=work_order.work_order_code,
        product_code=product.product_code if product else "UNKNOWN",
        product_name=product.product_name if product else "Unknown Product",
        current_stage=current_stage,
        current_stage_sequence=current_stage_sequence,
        completed_stages=completed_stages,
        total_stages=total_stages,
        quality_status=work_order.overall_quality_status,
        is_completed=work_order.is_completed,
        created_at=work_order.created_at
    )
