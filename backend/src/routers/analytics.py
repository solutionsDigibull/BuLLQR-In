"""Analytics and reporting endpoints."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date, datetime, timedelta
from typing import Optional
from src.database import get_db
from src.models import (
    ScanRecord, ProductionStage, Product, Operator,
    WorkOrder, ReworkCost, QualityStatusLog, ProductStage,
)
from src.auth.rbac import require_role

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _get_active_product(db: Session):
    return db.query(Product).filter(Product.is_active == True).first()


def _stage_progress(db: Session, product: Optional[Product], today_only: bool = False):
    # Use product-specific stages in product-specific sequence order when available
    if product:
        rows = (
            db.query(ProductionStage, ProductStage.sequence)
            .join(ProductStage, ProductStage.stage_id == ProductionStage.id)
            .filter(ProductStage.product_id == product.id)
            .order_by(ProductStage.sequence)
            .all()
        )
        if rows:
            stages = [(stage, seq) for stage, seq in rows]
        else:
            # Fallback: product has no stage assignments, use all global stages
            stages = [
                (s, s.stage_sequence)
                for s in db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
            ]
    else:
        stages = [
            (s, s.stage_sequence)
            for s in db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
        ]

    # Calculate today's start timestamp for filtering
    today_start = None
    if today_only:
        today = datetime.utcnow().date()
        today_start = datetime(today.year, today.month, today.day)

    result = []
    for s, seq in stages:
        q = db.query(ScanRecord).filter(ScanRecord.stage_id == s.id)
        if product:
            q = q.join(WorkOrder).filter(WorkOrder.product_id == product.id)
        if today_start:
            q = q.filter(ScanRecord.scan_timestamp >= today_start)
        total = q.count()
        ok = q.filter(ScanRecord.quality_status.in_(['ok', 'ok_update'])).count()
        not_ok = total - ok
        target = product.production_target if product and product.production_target else 0
        result.append({
            "stage_name": s.stage_name,
            "stage_sequence": seq,
            "current_count": total,
            "target_count": target,
            "ok_count": ok,
            "not_ok_count": not_ok,
            "progress_percentage": round((total / target * 100) if target > 0 else 0, 1),
        })
    return result


@router.get("/progress")
async def get_production_progress(db: Session = Depends(get_db)):
    """Production progress for all stages (current day only)."""
    product = _get_active_product(db)
    stages = _stage_progress(db, product, today_only=True)
    target_status = product.target_status if product else "not_set"
    total = sum(s["current_count"] for s in stages)
    target = sum(s["target_count"] for s in stages)
    return {
        "stages": stages,
        "target_status": target_status,
        "target_completion_percentage": round((total / target * 100) if target > 0 else 0, 1),
    }


@router.get("/dashboard")
async def get_dashboard(
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Combined dashboard data (current day scans)."""
    if product_id:
        product = db.query(Product).filter(Product.id == product_id).first()
    else:
        product = _get_active_product(db)
    stages = _stage_progress(db, product, today_only=True)
    target_status = product.target_status if product else "not_set"
    total = sum(s["current_count"] for s in stages)
    target = sum(s["target_count"] for s in stages)

    # Today's date boundary
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)

    # Quality stats — today only
    today_scans_q = db.query(ScanRecord).filter(ScanRecord.scan_timestamp >= today_start)
    if product:
        today_scans_q = today_scans_q.join(WorkOrder).filter(WorkOrder.product_id == product.id)
    total_scans = today_scans_q.count()
    ok_count = today_scans_q.filter(
        ScanRecord.quality_status.in_(['ok', 'ok_update'])
    ).count()
    not_ok_count = total_scans - ok_count

    # COPQ
    not_ok_records = db.query(ScanRecord).filter(
        ScanRecord.quality_status.in_(['not_ok', 'not_ok_update'])
    ).all()
    total_copq = 0.0
    rework_count = len(not_ok_records)
    for rec in not_ok_records:
        cost = db.query(ReworkCost).filter(ReworkCost.stage_id == rec.stage_id).first()
        if cost:
            total_copq += float(cost.cost_per_rework)

    # Today unique WO
    today_unique = db.query(func.count(func.distinct(ScanRecord.work_order_id))).filter(
        ScanRecord.scan_timestamp >= today_start
    ).scalar() or 0

    return {
        "production_progress": {
            "stages": stages,
            "target_status": target_status,
            "target_completion_percentage": round((total / target * 100) if target > 0 else 0, 1),
        },
        "quality_stats": {
            "total_scans": total_scans,
            "ok_count": ok_count,
            "not_ok_count": not_ok_count,
            "ok_percentage": round((ok_count / total_scans * 100) if total_scans else 0, 1),
            "not_ok_percentage": round((not_ok_count / total_scans * 100) if total_scans else 0, 1),
        },
        "copq_summary": {
            "total_copq": total_copq,
            "currency": "USD",
            "rework_count": rework_count,
        },
        "today_unique_count": today_unique,
    }


@router.get("/operator-performance")
async def get_operator_performance(
    days: int = Query(7, ge=1, le=365),
    today_only: bool = Query(False),
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Operator performance breakdown (operators only, excludes supervisors/QIs/admins)."""
    if today_only:
        today = datetime.utcnow().date()
        since = datetime(today.year, today.month, today.day)
    else:
        since = datetime.utcnow() - timedelta(days=days)
    operators = db.query(Operator).filter(
        Operator.is_active == True,
        Operator.role == "operator",
    ).all()
    result = []
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()

    for op in operators:
        stage_entries = []
        for s in stages:
            total_q = db.query(ScanRecord).filter(
                ScanRecord.operator_id == op.id,
                ScanRecord.stage_id == s.id,
                ScanRecord.scan_timestamp >= since,
            )
            ok_q = db.query(ScanRecord).filter(
                ScanRecord.operator_id == op.id,
                ScanRecord.stage_id == s.id,
                ScanRecord.scan_timestamp >= since,
                ScanRecord.quality_status.in_(['ok', 'ok_update']),
            )
            if product_id:
                total_q = total_q.join(WorkOrder).filter(WorkOrder.product_id == product_id)
                ok_q = ok_q.join(WorkOrder).filter(WorkOrder.product_id == product_id)
            total = total_q.count()
            ok = ok_q.count()
            stage_entries.append({
                "stage_name": s.stage_name,
                "scan_count": total,
                "ok_count": ok,
                "not_ok_count": total - ok,
                "ok_percentage": round((ok / total * 100) if total else 0, 1),
            })
        station = op.station_id or "N/A"
        result.append({
            "operator_name": op.full_name,
            "station_id": station,
            "display_name": f"{op.full_name} ({station})",
            "stages": stage_entries,
        })
    return {"operators": result}


@router.get("/operator-stage-matrix")
async def get_operator_stage_matrix(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Operator x stage matrix (operators only)."""
    since = datetime.utcnow() - timedelta(days=days)
    operators = db.query(Operator).filter(
        Operator.is_active == True,
        Operator.role == "operator",
    ).all()
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    stage_keys = {s.stage_name.lower().replace(" ", "_"): s for s in stages}

    matrix = []
    for op in operators:
        row = {
            "operator_name": op.full_name,
            "station_id": op.station_id or "N/A",
        }
        for key, s in stage_keys.items():
            total = db.query(ScanRecord).filter(
                ScanRecord.operator_id == op.id,
                ScanRecord.stage_id == s.id,
                ScanRecord.scan_timestamp >= since,
            ).count()
            ok = db.query(ScanRecord).filter(
                ScanRecord.operator_id == op.id,
                ScanRecord.stage_id == s.id,
                ScanRecord.scan_timestamp >= since,
                ScanRecord.quality_status.in_(['ok', 'ok_update']),
            ).count()
            row[key] = {
                "scan_count": total,
                "ok_count": ok,
                "not_ok_count": total - ok,
                "ok_percentage": round((ok / total * 100) if total else 0, 1),
            }
        matrix.append(row)
    return {"matrix": matrix}


@router.get("/quality-stats")
async def get_quality_stats(
    days: int = Query(7, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Quality statistics."""
    since = datetime.utcnow() - timedelta(days=days)
    total_scans = db.query(ScanRecord).filter(ScanRecord.scan_timestamp >= since).count()
    ok_count = db.query(ScanRecord).filter(
        ScanRecord.scan_timestamp >= since,
        ScanRecord.quality_status.in_(['ok', 'ok_update']),
    ).count()
    not_ok_count = total_scans - ok_count

    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    by_stage = []
    for s in stages:
        st = db.query(ScanRecord).filter(
            ScanRecord.stage_id == s.id, ScanRecord.scan_timestamp >= since
        ).count()
        sok = db.query(ScanRecord).filter(
            ScanRecord.stage_id == s.id,
            ScanRecord.scan_timestamp >= since,
            ScanRecord.quality_status.in_(['ok', 'ok_update']),
        ).count()
        by_stage.append({
            "stage_name": s.stage_name,
            "total": st,
            "ok": sok,
            "not_ok": st - sok,
            "ok_percentage": round((sok / st * 100) if st else 0, 1),
        })

    return {
        "total_scans": total_scans,
        "ok_count": ok_count,
        "not_ok_count": not_ok_count,
        "ok_percentage": round((ok_count / total_scans * 100) if total_scans else 0, 1),
        "not_ok_percentage": round((not_ok_count / total_scans * 100) if total_scans else 0, 1),
        "by_stage": by_stage,
    }


@router.get("/copq")
async def get_copq(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Cost of Poor Quality summary."""
    since = datetime.utcnow() - timedelta(days=days)
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    by_stage = []
    total_copq = 0.0
    total_rework = 0

    for s in stages:
        cnt = db.query(ScanRecord).filter(
            ScanRecord.stage_id == s.id,
            ScanRecord.scan_timestamp >= since,
            ScanRecord.quality_status.in_(['not_ok', 'not_ok_update']),
        ).count()
        cost = db.query(ReworkCost).filter(ReworkCost.stage_id == s.id).first()
        cost_per = float(cost.cost_per_rework) if cost else 0.0
        stage_total = cnt * cost_per
        total_copq += stage_total
        total_rework += cnt
        by_stage.append({
            "stage_name": s.stage_name,
            "rework_count": cnt,
            "total_cost": stage_total,
            "avg_cost_per_rework": cost_per,
        })

    return {
        "total_copq": total_copq,
        "currency": "USD",
        "rework_count": total_rework,
        "by_stage": by_stage,
        "date_range": {
            "start_date": since.date().isoformat(),
            "end_date": datetime.utcnow().date().isoformat(),
        },
    }


@router.get("/reports/{report_type}")
async def download_report(
    report_type: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
    product_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Download Excel report for scans, rework history, or combined."""
    from src.services.report_export import (
        generate_scan_records_excel,
        generate_rework_history_excel,
        generate_two_sheet_report,
    )

    sd = date.fromisoformat(start_date)
    ed = date.fromisoformat(end_date)

    if report_type == "scans":
        output = generate_scan_records_excel(db, sd, ed, product_id)
        filename = f"scan_records_{start_date}_{end_date}.xlsx"
    elif report_type == "rework":
        output = generate_rework_history_excel(db, sd, ed, product_id)
        filename = f"rework_history_{start_date}_{end_date}.xlsx"
    elif report_type == "combined":
        output = generate_two_sheet_report(db, sd, ed, product_id)
        filename = f"production_report_{start_date}_{end_date}.xlsx"
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid report type")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
