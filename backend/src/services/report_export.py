"""Excel export service — two-sheet report (Detailed Scans + COPQ Summary)."""
import io
from datetime import date, datetime
from sqlalchemy.orm import Session
import xlsxwriter

from src.models import (
    ScanRecord, WorkOrder, ProductionStage, Operator, Product, ReworkCost,
)
from src.models.rework_history import ReworkHistory
from src.utils.timezone import utc_to_ist


def generate_scan_records_excel(db: Session, start: date, end: date, product_id: str = None) -> io.BytesIO:
    """Generate Excel workbook with scan records sheet."""
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})

    _write_scan_sheet(wb, db, start, end, product_id)

    wb.close()
    output.seek(0)
    return output


def generate_rework_history_excel(db: Session, start: date, end: date, product_id: str = None) -> io.BytesIO:
    """Generate Excel workbook with rework/COPQ sheet."""
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})

    _write_copq_sheet(wb, db, start, end, product_id)

    wb.close()
    output.seek(0)
    return output


def generate_two_sheet_report(db: Session, start: date, end: date, product_id: str = None) -> io.BytesIO:
    """Generate Excel workbook with both scan records and COPQ summary sheets."""
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})

    _write_scan_sheet(wb, db, start, end, product_id)
    _write_copq_sheet(wb, db, start, end, product_id)

    wb.close()
    output.seek(0)
    return output


def _write_scan_sheet(wb, db: Session, start: date, end: date, product_id: str = None):
    """Write detailed scan records sheet."""
    ws = wb.add_worksheet("Detailed Scans")

    # Formats
    header_fmt = wb.add_format({
        "bold": True, "bg_color": "#4472C4", "font_color": "white",
        "border": 1, "text_wrap": True,
    })
    cell_fmt = wb.add_format({"border": 1})
    date_fmt = wb.add_format({"border": 1, "num_format": "dd-mmm-yyyy hh:mm AM/PM"})

    headers = [
        "S.No", "Serial Number", "Month", "Date & Time (IST)", "Stage",
        "Work Order", "Product", "Operator", "Operator ID",
        "Supervisor", "Quality Inspector", "Quality Status", "Scan Type",
    ]
    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    # Set column widths
    widths = [6, 15, 10, 22, 18, 25, 20, 20, 15, 20, 20, 15, 15]
    for i, w in enumerate(widths):
        ws.set_column(i, i, w)

    # Query scans in date range
    start_dt = datetime(start.year, start.month, start.day)
    end_dt = datetime(end.year, end.month, end.day, 23, 59, 59)

    q = (
        db.query(ScanRecord)
        .filter(ScanRecord.scan_timestamp >= start_dt, ScanRecord.scan_timestamp <= end_dt)
    )
    if product_id:
        q = q.join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id).filter(WorkOrder.product_id == product_id)
    scans = q.order_by(ScanRecord.scan_timestamp.asc()).all()

    row = 1
    for s in scans:
        wo = db.query(WorkOrder).filter(WorkOrder.id == s.work_order_id).first()
        stage = db.query(ProductionStage).filter(ProductionStage.id == s.stage_id).first()
        op = db.query(Operator).filter(Operator.id == s.operator_id).first()
        supervisor = db.query(Operator).filter(Operator.id == s.supervisor_id).first() if s.supervisor_id else None
        qi = db.query(Operator).filter(Operator.id == s.quality_inspector_id).first() if s.quality_inspector_id else None
        product = db.query(Product).filter(Product.id == wo.product_id).first() if wo else None

        ist_time = utc_to_ist(s.scan_timestamp) if s.scan_timestamp else None
        month_str = ist_time.strftime("%B %Y") if ist_time else ""
        time_str = ist_time.strftime("%d-%b-%Y %I:%M %p") if ist_time else ""

        ws.write(row, 0, row, cell_fmt)
        ws.write(row, 1, wo.serial_number if wo else "", cell_fmt)
        ws.write(row, 2, month_str, cell_fmt)
        ws.write(row, 3, time_str, cell_fmt)
        ws.write(row, 4, stage.stage_name if stage else "", cell_fmt)
        ws.write(row, 5, wo.work_order_code if wo else "", cell_fmt)
        ws.write(row, 6, product.product_name if product else "", cell_fmt)
        ws.write(row, 7, op.full_name if op else "", cell_fmt)
        ws.write(row, 8, op.username if op else "", cell_fmt)
        ws.write(row, 9, supervisor.full_name if supervisor else "", cell_fmt)
        ws.write(row, 10, qi.full_name if qi else "", cell_fmt)
        ws.write(row, 11, s.quality_status, cell_fmt)
        ws.write(row, 12, s.scan_type, cell_fmt)
        row += 1


def _write_copq_sheet(wb, db: Session, start: date, end: date, product_id: str = None):
    """Write COPQ summary sheet."""
    ws = wb.add_worksheet("COPQ Summary")

    header_fmt = wb.add_format({
        "bold": True, "bg_color": "#4472C4", "font_color": "white",
        "border": 1, "text_wrap": True,
    })
    cell_fmt = wb.add_format({"border": 1})
    cost_fmt = wb.add_format({"border": 1, "num_format": "#,##0.00"})
    total_fmt = wb.add_format({"bold": True, "border": 1, "bg_color": "#FFF2CC"})
    total_cost_fmt = wb.add_format({"bold": True, "border": 1, "bg_color": "#FFF2CC", "num_format": "#,##0.00"})

    headers = [
        "Stage", "Work Order", "Total Rejections", "Reworked Count",
        "Rework Detail", "Detail Count", "COPQ Cost",
    ]
    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    widths = [18, 25, 16, 14, 25, 12, 14]
    for i, w in enumerate(widths):
        ws.set_column(i, i, w)

    start_dt = datetime(start.year, start.month, start.day)
    end_dt = datetime(end.year, end.month, end.day, 23, 59, 59)

    stages = db.query(ProductionStage).order_by(ProductionStage.stage_sequence).all()

    row = 1
    grand_total_rejected = 0
    grand_total_reworked = 0
    grand_total_cost = 0.0

    for s in stages:
        # Rejected scans
        rejected_q = (
            db.query(ScanRecord)
            .filter(
                ScanRecord.stage_id == s.id,
                ScanRecord.quality_status.in_(["not_ok", "not_ok_update"]),
                ScanRecord.scan_timestamp >= start_dt,
                ScanRecord.scan_timestamp <= end_dt,
            )
        )
        if product_id:
            rejected_q = rejected_q.join(WorkOrder, ScanRecord.work_order_id == WorkOrder.id).filter(WorkOrder.product_id == product_id)
        rejected_count = rejected_q.count()

        # Active rework entries with work order info
        rework_q = (
            db.query(ReworkHistory)
            .filter(
                ReworkHistory.stage_id == s.id,
                ReworkHistory.is_active == True,
                ReworkHistory.rework_date >= start_dt,
                ReworkHistory.rework_date <= end_dt,
            )
        )
        if product_id:
            rework_q = rework_q.join(WorkOrder, ReworkHistory.work_order_id == WorkOrder.id).filter(WorkOrder.product_id == product_id)
        rework_entries = rework_q.order_by(ReworkHistory.rework_date.asc()).all()

        reworked_count = len(rework_entries)
        stage_cost = sum(float(r.copq_cost) for r in rework_entries)

        grand_total_rejected += rejected_count
        grand_total_reworked += reworked_count
        grand_total_cost += stage_cost

        if rework_entries:
            first = True
            for r in rework_entries:
                wo = db.query(WorkOrder).filter(WorkOrder.id == r.work_order_id).first()
                wo_code = wo.work_order_code if wo else ""
                if first:
                    ws.write(row, 0, s.stage_name, cell_fmt)
                    ws.write(row, 2, rejected_count, cell_fmt)
                    ws.write(row, 3, reworked_count, cell_fmt)
                    first = False
                else:
                    ws.write(row, 0, "", cell_fmt)
                    ws.write(row, 2, "", cell_fmt)
                    ws.write(row, 3, "", cell_fmt)
                ws.write(row, 1, wo_code, cell_fmt)
                ws.write(row, 4, r.rework_detail, cell_fmt)
                ws.write(row, 5, 1, cell_fmt)
                ws.write(row, 6, float(r.copq_cost), cost_fmt)
                row += 1
        else:
            ws.write(row, 0, s.stage_name, cell_fmt)
            ws.write(row, 1, "", cell_fmt)
            ws.write(row, 2, rejected_count, cell_fmt)
            ws.write(row, 3, reworked_count, cell_fmt)
            ws.write(row, 4, "—", cell_fmt)
            ws.write(row, 5, 0, cell_fmt)
            ws.write(row, 6, 0.0, cost_fmt)
            row += 1

    # Totals row
    ws.write(row, 0, "TOTAL", total_fmt)
    ws.write(row, 1, "", total_fmt)
    ws.write(row, 2, grand_total_rejected, total_fmt)
    ws.write(row, 3, grand_total_reworked, total_fmt)
    ws.write(row, 4, "", total_fmt)
    ws.write(row, 5, "", total_fmt)
    ws.write(row, 6, grand_total_cost, total_cost_fmt)
