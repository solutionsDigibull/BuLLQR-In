"""Quality inspection and status management service."""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from src.models import Operator, ScanRecord, QualityStatusLog, WorkOrder, ProductionStage
from src.utils.timezone import today_ist_start_naive
from datetime import datetime
import uuid


def validate_quality_inspector(db: Session, quality_inspector_id: uuid.UUID) -> Operator:
    """
    Validate that the quality inspector exists, is active, and has the quality_inspector role.

    Args:
        db: Database session
        quality_inspector_id: UUID of the quality inspector

    Returns:
        Operator: The validated quality inspector

    Raises:
        HTTPException 404: If quality inspector not found or inactive
        HTTPException 403: If operator does not have quality_inspector role
    """
    quality_inspector = db.query(Operator).filter(
        Operator.id == quality_inspector_id,
        Operator.is_active == True
    ).first()

    if not quality_inspector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quality Inspector {quality_inspector_id} not found or inactive"
        )

    if quality_inspector.role not in ['quality_inspector', 'supervisor', 'admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operator {quality_inspector.full_name} does not have quality inspector privileges. "
                   f"Role: {quality_inspector.role}"
        )

    return quality_inspector


def check_first_article_approval_required(
    db: Session,
    stage_id: uuid.UUID
) -> bool:
    """
    Check if first article approval is required at this stage today.

    First article is required if no scans exist TODAY at this stage. Scope is
    per-(stage, day), independent of product: the very first scan of the day
    at a given stage is the FA, regardless of which product the operator has
    selected.

    Args:
        db: Database session
        stage_id: Production stage UUID

    Returns:
        bool: True if first article approval is required, False otherwise
    """
    day_start = today_ist_start_naive()

    existing_scan = db.query(ScanRecord).filter(
        ScanRecord.stage_id == stage_id,
        ScanRecord.scan_timestamp >= day_start,
    ).first()

    return existing_scan is None


def check_first_article_approved(
    db: Session,
    stage_id: uuid.UUID
) -> bool:
    """
    Check if the first article at this stage has been approved TODAY.

    Scope is per-(stage, day), independent of product.

    Args:
        db: Database session
        stage_id: Production stage UUID

    Returns:
        bool: True if first article has been approved today, False otherwise
    """
    day_start = today_ist_start_naive()

    approved_first_article = db.query(ScanRecord).filter(
        ScanRecord.stage_id == stage_id,
        ScanRecord.is_first_article == True,
        ScanRecord.quality_inspector_id.isnot(None),
        ScanRecord.scan_timestamp >= day_start,
    ).first()

    return approved_first_article is not None


def classify_scan_type(
    db: Session,
    work_order_id: uuid.UUID,
    stage_id: uuid.UUID
) -> str:
    """
    Classify the scan type based on existing scan history.

    Args:
        db: Database session
        work_order_id: Work order UUID
        stage_id: Production stage UUID

    Returns:
        str: Scan type ('first_article', 'normal', or 'update')
    """
    existing_scan = db.query(ScanRecord).filter(
        ScanRecord.work_order_id == work_order_id,
        ScanRecord.stage_id == stage_id
    ).first()

    if existing_scan:
        return "update"

    if check_first_article_approval_required(db, stage_id):
        return "first_article"

    return "normal"


def update_quality_status(
    db: Session,
    scan_record_id: uuid.UUID,
    new_status: str,
    operator_id: uuid.UUID,
    reason: str = None
) -> tuple[ScanRecord, QualityStatusLog]:
    """
    Update the quality status of a scan record.

    Creates an audit trail entry in quality_status_log and updates the scan record.
    Prevents updating to the same status (duplicate status updates).

    Args:
        db: Database session
        scan_record_id: UUID of the scan record to update
        new_status: New quality status (ok_update or not_ok_update)
        operator_id: UUID of operator performing the update
        reason: Optional reason for the update

    Returns:
        tuple: (Updated ScanRecord, QualityStatusLog entry)

    Raises:
        HTTPException 404: If scan record not found
        HTTPException 400: If operator not found or inactive
        HTTPException 409: If trying to update to same status (duplicate)
    """
    # Get the scan record
    scan_record = db.query(ScanRecord).filter(
        ScanRecord.id == scan_record_id
    ).first()

    if not scan_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan record {scan_record_id} not found"
        )

    # Validate operator
    operator = db.query(Operator).filter(
        Operator.id == operator_id,
        Operator.is_active == True
    ).first()

    if not operator:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operator {operator_id} not found or inactive"
        )

    # Check for duplicate status update
    if scan_record.quality_status == new_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update to same status '{new_status}'. Current status is already '{scan_record.quality_status}'."
        )

    # Store previous status
    previous_status = scan_record.quality_status

    # Create audit trail entry
    status_log = QualityStatusLog(
        id=uuid.uuid4(),
        scan_record_id=scan_record.id,
        work_order_id=scan_record.work_order_id,
        stage_id=scan_record.stage_id,
        operator_id=operator_id,
        previous_status=previous_status,
        new_status=new_status,
        change_reason=reason,
        changed_at=datetime.utcnow()
    )

    # Update scan record
    scan_record.previous_quality_status = previous_status
    scan_record.quality_status = new_status
    scan_record.scan_type = "update"  # Mark as update scan

    db.add(status_log)
    db.commit()
    db.refresh(scan_record)
    db.refresh(status_log)

    return scan_record, status_log


def calculate_copq_impact(
    db: Session,
    work_order_id: uuid.UUID,
    stage_id: uuid.UUID,
    new_status: str
) -> float:
    """
    Calculate the Cost of Poor Quality (COPQ) impact for a status change.

    Returns the rework cost if status is not_ok or not_ok_update, otherwise 0.

    Args:
        db: Database session
        work_order_id: Work order UUID
        stage_id: Production stage UUID
        new_status: New quality status

    Returns:
        float: COPQ cost impact (0 if status is ok/ok_update)
    """
    from src.models import ReworkCost

    # Only calculate cost for not_ok statuses
    if new_status not in ['not_ok', 'not_ok_update']:
        return 0.0

    # Get rework cost for this stage
    rework_cost = db.query(ReworkCost).filter(
        ReworkCost.stage_id == stage_id
    ).first()

    if not rework_cost:
        # No rework cost configured, return default
        return 0.0

    return float(rework_cost.cost_per_rework)
