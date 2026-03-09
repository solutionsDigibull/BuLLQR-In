"""Build a plain-text production data summary for the AI system prompt."""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.models import (
    Product, ProductionStage, ScanRecord, WorkOrder,
    Operator, ReworkCost, ReworkConfig, ReworkHistory, ProductionTarget,
)


def build_production_context(db: Session) -> str:
    """Query the DB and return a concise text summary of current production state."""
    lines: list[str] = []

    # --- Active product ---
    product = db.query(Product).filter(Product.is_active == True).first()
    if product:
        lines.append(f"Active Product: {product.product_name} ({product.product_code})")
        lines.append(f"  Production target: {product.production_target or 'not set'}")
        lines.append(f"  Target status: {product.target_status}")
    else:
        lines.append("No active product configured.")

    # --- Stage progress ---
    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()
    lines.append("\nStage Progress:")
    for s in stages:
        q = db.query(ScanRecord).filter(ScanRecord.stage_id == s.id)
        if product:
            q = q.join(WorkOrder).filter(WorkOrder.product_id == product.id)
        total = q.count()
        ok = q.filter(ScanRecord.quality_status.in_(["ok", "ok_update"])).count()
        not_ok = total - ok
        target = product.production_target if product and product.production_target else 0
        pct = round((total / target * 100) if target > 0 else 0, 1)
        lines.append(
            f"  {s.stage_sequence}. {s.stage_name}: "
            f"{total} scans ({ok} OK, {not_ok} NOT OK) — {pct}% of target"
        )

    # --- Quality stats (all-time) ---
    total_scans = db.query(ScanRecord).count()
    ok_all = db.query(ScanRecord).filter(
        ScanRecord.quality_status.in_(["ok", "ok_update"])
    ).count()
    not_ok_all = total_scans - ok_all
    ok_pct = round((ok_all / total_scans * 100) if total_scans else 0, 1)
    lines.append(f"\nOverall Quality: {total_scans} total scans, {ok_pct}% OK, {not_ok_all} rejects")

    # --- Today's count ---
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)
    today_unique = db.query(
        func.count(func.distinct(ScanRecord.work_order_id))
    ).filter(ScanRecord.scan_timestamp >= today_start).scalar() or 0
    today_scans = db.query(ScanRecord).filter(
        ScanRecord.scan_timestamp >= today_start
    ).count()
    lines.append(f"\nToday ({today.isoformat()}): {today_unique} unique assemblies, {today_scans} scans")

    # --- COPQ ---
    not_ok_records = db.query(ScanRecord).filter(
        ScanRecord.quality_status.in_(["not_ok", "not_ok_update"])
    ).all()
    total_copq = 0.0
    for rec in not_ok_records:
        cost = db.query(ReworkCost).filter(ReworkCost.stage_id == rec.stage_id).first()
        if cost:
            total_copq += float(cost.cost_per_rework)
    lines.append(f"COPQ (Cost of Poor Quality): ${total_copq:,.2f} USD ({len(not_ok_records)} rework events)")

    # --- Daily production target ---
    daily_target = db.query(ProductionTarget).filter(
        ProductionTarget.target_date == today
    ).first()
    if daily_target:
        lines.append(
            f"Daily Target: {daily_target.target_quantity} units, "
            f"completed: {'yes' if daily_target.is_completed else 'no'}"
        )

    # --- Operators ---
    active_ops = db.query(Operator).filter(
        Operator.is_active == True,
        Operator.role == "operator",
    ).all()
    lines.append(f"\nActive Operators: {len(active_ops)}")
    for op in active_ops[:10]:
        station = op.station_id or "N/A"
        lines.append(f"  - {op.full_name} (station: {station})")

    # --- Recent rework reasons (last 7 days) ---
    since = datetime.utcnow() - timedelta(days=7)
    recent_rework = (
        db.query(ReworkHistory.rework_detail, func.count(ReworkHistory.id))
        .filter(ReworkHistory.rework_date >= since, ReworkHistory.is_active == True)
        .group_by(ReworkHistory.rework_detail)
        .order_by(func.count(ReworkHistory.id).desc())
        .limit(5)
        .all()
    )
    if recent_rework:
        lines.append("\nTop Rework Reasons (last 7 days):")
        for reason, cnt in recent_rework:
            lines.append(f"  - {reason}: {cnt} occurrences")

    return "\n".join(lines)
