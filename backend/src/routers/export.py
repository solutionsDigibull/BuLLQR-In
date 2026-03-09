"""Excel export endpoints — two-sheet report."""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
from src.database import get_db
from src.auth.rbac import require_role
from src.services.report_export import generate_two_sheet_report

router = APIRouter(prefix="/api/v1/export", tags=["export"])


@router.post("/generate-reports")
async def generate_reports(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Generate two-sheet Excel report (Detailed Scans + COPQ Summary)."""
    sd = date.fromisoformat(start_date) if start_date else date(2020, 1, 1)
    ed = date.fromisoformat(end_date) if end_date else date.today()

    output = generate_two_sheet_report(db, sd, ed)
    filename = f"production_report_{sd.isoformat()}_{ed.isoformat()}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/download-reports")
async def download_reports(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Download two-sheet Excel report (Detailed Scans + COPQ Summary)."""
    sd = date.fromisoformat(start_date) if start_date else date(2020, 1, 1)
    ed = date.fromisoformat(end_date) if end_date else date.today()

    output = generate_two_sheet_report(db, sd, ed)
    filename = f"production_report_{sd.isoformat()}_{ed.isoformat()}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
