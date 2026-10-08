from datetime import datetime
import logging
from typing import Optional
from fastapi import APIRouter, Query, Response
from fastapi.responses import StreamingResponse

from app.services.attendance_service import attendance_service
from app.services.report_service import report_service

logger = logging.getLogger("faceattend.routes.reports")
router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

@router.get("/dashboard")
async def get_dashboard():
    return await report_service.get_dashboard_stats()

@router.get("/daily")
async def get_daily_report(
    date: Optional[str] = Query(None, description="Report date in YYYY-MM-DD format (defaults to today)"),
    branch: Optional[str] = Query(None, description="Optional branch filter")
):
    if not date:
        date, _, _, _ = attendance_service.get_server_datetime()
    return await report_service.get_daily_report(date, branch)

@router.get("/monthly")
async def get_monthly_report(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format (defaults to current month)"),
    branch: Optional[str] = Query(None, description="Optional branch filter"),
    mode: Optional[str] = Query("active", description="active (working dates with attendance) or all_month (1-31)")
):
    if not month:
        date, _, _, _ = attendance_service.get_server_datetime()
        month = date[:7]
    return await report_service.get_monthly_report(month, branch, mode or "active")

@router.get("/export/csv")
async def export_attendance_csv(
    date: Optional[str] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    studentId: Optional[str] = Query(None)
):
    query = {}
    if date:
        query["date"] = date
    elif startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    if branch:
        query["branch"] = branch
    if studentId:
        query["studentId"] = studentId

    csv_data = await report_service.export_csv(query)
    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/excel")
async def export_attendance_excel(
    date: Optional[str] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    studentId: Optional[str] = Query(None)
):
    query = {}
    if date:
        query["date"] = date
    elif startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    if branch:
        query["branch"] = branch
    if studentId:
        query["studentId"] = studentId

    excel_buffer = await report_service.export_excel(query)
    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/monthly-register")
async def export_monthly_register_excel(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format (defaults to current month)"),
    branch: Optional[str] = Query(None, description="Optional department/branch filter"),
    mode: Optional[str] = Query("active", description="active (working dates with attendance) or all_month (1-31)")
):
    """
    Exports monthly attendance register matrix matching college ledger sheet:
    S NO | ROLL NO | NAME | D1 | D2 ... | TOTAL ATT. | PERCENTAGE
    with P (Present) and A (Absent) cells.
    """
    if not month:
        date, _, _, _ = attendance_service.get_server_datetime()
        month = date[:7]

    excel_buffer = await report_service.export_monthly_register_excel(month, branch, mode or "active")
    clean_branch = f"_{branch}" if branch and branch.upper() != "ALL" else ""
    filename = f"monthly_attendance_register_{month}{clean_branch}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/monthly-register/csv")
async def export_monthly_register_csv(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format (defaults to current month)"),
    branch: Optional[str] = Query(None, description="Optional department/branch filter"),
    mode: Optional[str] = Query("active", description="active or all_month")
):
    if not month:
        date, _, _, _ = attendance_service.get_server_datetime()
        month = date[:7]

    csv_data = await report_service.export_monthly_register_csv(month, branch, mode or "active")
    clean_branch = f"_{branch}" if branch and branch.upper() != "ALL" else ""
    filename = f"monthly_attendance_register_{month}{clean_branch}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
