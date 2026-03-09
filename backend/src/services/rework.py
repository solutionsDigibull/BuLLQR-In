"""Rework management service — rejected cables, apply rework, COPQ summary."""
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from datetime import datetime, date
from typing import Optional
import uuid

from src.models import (
    ScanRecord, WorkOrder, ProductionStage, Operator, ReworkCost,
)
from src.models.rework_config import ReworkConfig
from src.models.rework_history import ReworkHistory


def get_rejected_cables(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    no_rework_only: bool = False,
):
    """Query ScanRecords with quality_status in (not_ok, not_ok_update), join rework info."""
    q = (
        db.query(ScanRecord)
        .filter(ScanRecord.quality_status.in_(["not_ok", "not_ok_update"]))
        .order_by(ScanRecord.scan_timestamp.desc())
    )

    if start_date:
        q = q.filter(ScanRecord.scan_timestamp >= datetime(start_date.year, start_date.month, start_date.day))
    if end_date:
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
        q = q.filter(ScanRecord.scan_timestamp <= end_dt)

    total = q.count()
    scans = q.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for s in scans:
        wo = db.query(WorkOrder).filter(WorkOrder.id == s.work_order_id).first()
        stage = db.query(ProductionStage).filter(ProductionStage.id == s.stage_id).first()
        op = db.query(Operator).filter(Operator.id == s.operator_id).first()

        # Find active rework entry for this scan
        rework = (
            db.query(ReworkHistory)
            .filter(ReworkHistory.scan_record_id == s.id, ReworkHistory.is_active == True)
            .first()
        )

        if no_rework_only and rework:
            continue

        results.append({
            "scan_id": str(s.id),
            "work_order_id": str(s.work_order_id),
            "work_order_code": wo.work_order_code if wo else "",
            "serial_number": wo.serial_number if wo else None,
            "stage_name": stage.stage_name if stage else "",
            "stage_id": str(s.stage_id),
            "operator_name": op.full_name if op else "Unknown",
            "quality_status": s.quality_status,
            "scan_timestamp": s.scan_timestamp.isoformat() if s.scan_timestamp else "",
            "rework_detail": rework.rework_detail if rework else None,
            "rework_copq_cost": float(rework.copq_cost) if rework else None,
            "rework_applied_by": rework.applied_by if rework else None,
            "rework_date": rework.rework_date.isoformat() if rework and rework.rework_date else None,
            "rework_history_id": str(rework.id) if rework else None,
            "rework_notes": rework.notes if rework else None,
        })

    return {"items": results, "total": total, "page": page, "per_page": per_page}


def apply_rework(
    db: Session,
    scan_record_id: uuid.UUID,
    work_order_id: uuid.UUID,
    rework_config_id: uuid.UUID,
    applied_by: str,
    notes: Optional[str] = None,
):
    """Apply rework to a rejected cable. Deactivates any existing active rework for this scan."""
    # Validate scan record
    scan = db.query(ScanRecord).filter(ScanRecord.id == scan_record_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan record not found")
    if scan.quality_status not in ("not_ok", "not_ok_update"):
        raise HTTPException(status_code=400, detail="Scan is not rejected — cannot apply rework")

    # Validate rework config
    config = db.query(ReworkConfig).filter(ReworkConfig.id == rework_config_id, ReworkConfig.is_active == True).first()
    if not config:
        raise HTTPException(status_code=404, detail="Rework config not found or inactive")

    # Get stage and operator info for snapshot
    stage = db.query(ProductionStage).filter(ProductionStage.id == scan.stage_id).first()
    op = db.query(Operator).filter(Operator.id == scan.operator_id).first()

    # Deactivate existing rework entries for this scan
    db.query(ReworkHistory).filter(
        ReworkHistory.scan_record_id == scan_record_id,
        ReworkHistory.is_active == True,
    ).update({"is_active": False})

    # Create new rework history entry
    rh = ReworkHistory(
        id=uuid.uuid4(),
        work_order_id=work_order_id,
        scan_record_id=scan_record_id,
        rework_config_id=rework_config_id,
        rework_detail=config.rework_detail,
        copq_cost=config.copq_cost,
        stage_id=scan.stage_id,
        stage_name=stage.stage_name if stage else None,
        operator_name=op.full_name if op else None,
        applied_by=applied_by,
        rework_date=datetime.utcnow(),
        notes=notes,
        is_active=True,
    )
    db.add(rh)
    db.commit()
    db.refresh(rh)

    return {
        "id": str(rh.id),
        "work_order_id": str(rh.work_order_id),
        "scan_record_id": str(rh.scan_record_id),
        "rework_config_id": str(rh.rework_config_id) if rh.rework_config_id else None,
        "rework_detail": rh.rework_detail,
        "copq_cost": float(rh.copq_cost),
        "stage_name": rh.stage_name,
        "operator_name": rh.operator_name,
        "applied_by": rh.applied_by,
        "rework_date": rh.rework_date.isoformat(),
        "notes": rh.notes,
        "is_active": rh.is_active,
    }


def update_rework_type(
    db: Session,
    rework_history_id: uuid.UUID,
    new_config_id: uuid.UUID,
    applied_by: str,
    notes: Optional[str] = None,
):
    """Change the rework type for an existing rework history entry."""
    rh = db.query(ReworkHistory).filter(ReworkHistory.id == rework_history_id).first()
    if not rh:
        raise HTTPException(status_code=404, detail="Rework history entry not found")

    config = db.query(ReworkConfig).filter(ReworkConfig.id == new_config_id, ReworkConfig.is_active == True).first()
    if not config:
        raise HTTPException(status_code=404, detail="Rework config not found or inactive")

    # Deactivate old entry
    rh.is_active = False

    # Create new active entry
    new_rh = ReworkHistory(
        id=uuid.uuid4(),
        work_order_id=rh.work_order_id,
        scan_record_id=rh.scan_record_id,
        rework_config_id=new_config_id,
        rework_detail=config.rework_detail,
        copq_cost=config.copq_cost,
        stage_id=rh.stage_id,
        stage_name=rh.stage_name,
        operator_name=rh.operator_name,
        applied_by=applied_by,
        rework_date=datetime.utcnow(),
        notes=notes,
        is_active=True,
    )
    db.add(new_rh)
    db.commit()
    db.refresh(new_rh)

    return {
        "id": str(new_rh.id),
        "work_order_id": str(new_rh.work_order_id),
        "scan_record_id": str(new_rh.scan_record_id),
        "rework_config_id": str(new_rh.rework_config_id) if new_rh.rework_config_id else None,
        "rework_detail": new_rh.rework_detail,
        "copq_cost": float(new_rh.copq_cost),
        "stage_name": new_rh.stage_name,
        "operator_name": new_rh.operator_name,
        "applied_by": new_rh.applied_by,
        "rework_date": new_rh.rework_date.isoformat(),
        "notes": new_rh.notes,
        "is_active": new_rh.is_active,
    }


def get_rework_history_for_scan(
    db: Session,
    scan_record_id: uuid.UUID,
):
    """Get all rework history entries (active + inactive) for a scan record, ordered by date."""
    entries = (
        db.query(ReworkHistory)
        .filter(ReworkHistory.scan_record_id == scan_record_id)
        .order_by(ReworkHistory.rework_date.asc())
        .all()
    )

    results = []
    for r in entries:
        results.append({
            "id": str(r.id),
            "rework_detail": r.rework_detail,
            "copq_cost": float(r.copq_cost),
            "applied_by": r.applied_by,
            "rework_date": r.rework_date.isoformat() if r.rework_date else None,
            "notes": r.notes,
            "is_active": r.is_active,
        })

    return results


def get_copq_summary(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """COPQ summary from active rework_history grouped by stage."""
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()

    total_rejected = 0
    total_reworked = 0
    total_cost = 0.0
    by_stage = []

    for s in stages:
        # Count rejected scans at this stage
        q_rejected = db.query(ScanRecord).filter(
            ScanRecord.stage_id == s.id,
            ScanRecord.quality_status.in_(["not_ok", "not_ok_update"]),
        )
        if start_date:
            q_rejected = q_rejected.filter(
                ScanRecord.scan_timestamp >= datetime(start_date.year, start_date.month, start_date.day)
            )
        if end_date:
            end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
            q_rejected = q_rejected.filter(ScanRecord.scan_timestamp <= end_dt)

        rejection_count = q_rejected.count()
        total_rejected += rejection_count

        # Get active rework entries for this stage
        q_rework = db.query(ReworkHistory).filter(
            ReworkHistory.stage_id == s.id,
            ReworkHistory.is_active == True,
        )
        if start_date:
            q_rework = q_rework.filter(
                ReworkHistory.rework_date >= datetime(start_date.year, start_date.month, start_date.day)
            )
        if end_date:
            end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
            q_rework = q_rework.filter(ReworkHistory.rework_date <= end_dt)

        rework_entries = q_rework.all()
        reworked_count = len(rework_entries)
        total_reworked += reworked_count

        stage_cost = sum(float(r.copq_cost) for r in rework_entries)
        total_cost += stage_cost

        # Group by rework_detail
        detail_counts = {}
        for r in rework_entries:
            key = r.rework_detail
            if key not in detail_counts:
                detail_counts[key] = {"rework_detail": key, "count": 0, "total_cost": 0.0}
            detail_counts[key]["count"] += 1
            detail_counts[key]["total_cost"] += float(r.copq_cost)

        by_stage.append({
            "stage_name": s.stage_name,
            "rejection_count": rejection_count,
            "reworked_count": reworked_count,
            "total_copq_cost": stage_cost,
            "rework_details": list(detail_counts.values()),
        })

    now = datetime.utcnow().date()
    return {
        "total_rejected": total_rejected,
        "total_reworked": total_reworked,
        "total_copq_cost": total_cost,
        "by_stage": by_stage,
        "date_range": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else now.isoformat(),
        },
    }
