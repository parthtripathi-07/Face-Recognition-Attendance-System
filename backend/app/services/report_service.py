import csv
import calendar
from datetime import datetime, timedelta
import io
import logging
from typing import Any, Dict, List, Optional
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.database import db_manager
from app.services.attendance_service import attendance_service

logger = logging.getLogger("faceattend.report_service")

class ReportService:
    @staticmethod
    async def get_dashboard_stats() -> Dict[str, Any]:
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]
        date_str, _, _, _ = attendance_service.get_server_datetime()

        total_students = await students_coll.count_documents({})
        today_records = await att_coll.find({"date": date_str}).to_list(length=2000)
        
        # Unique students present today
        present_student_ids = {r.get("studentId") for r in today_records}
        present_today = len(present_student_ids)
        absent_today = max(0, total_students - present_today)
        pct = round((present_today / total_students * 100), 1) if total_students > 0 else 0.0

        # Last 7 Days Trend
        today_dt = datetime.strptime(date_str, "%Y-%m-%d")
        trend = []
        for i in range(6, -1, -1):
            target_date = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
            records = await att_coll.find({"date": target_date}).to_list(length=2000)
            p_ids = {r.get("studentId") for r in records}
            p_count = len(p_ids)
            ab_count = max(0, total_students - p_count)
            p_pct = round((p_count / total_students * 100), 1) if total_students > 0 else 0.0
            
            day_name = (today_dt - timedelta(days=i)).strftime("%a")
            trend.append({
                "date": target_date,
                "day": day_name,
                "present": p_count,
                "absent": ab_count,
                "percentage": p_pct
            })

        # Weekly breakdown (Mon - Sat)
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        weekly_map = {d: {"present": 0, "total": 0} for d in weekday_names}
        for t in trend:
            if t["day"] in weekly_map:
                weekly_map[t["day"]]["present"] = t["present"]
                weekly_map[t["day"]]["total"] = total_students

        weekly_chart = [
            {"day": d, "present": weekly_map[d]["present"], "total": weekly_map[d]["total"]}
            for d in weekday_names
        ]

        # Department / Branch breakdown
        all_students = await students_coll.find({}).to_list(length=2000)
        branch_map = {}
        for s in all_students:
            br = (s.get("branch") or "GENERAL").strip().upper()
            if br not in branch_map:
                branch_map[br] = {"branch": br, "total": 0, "present": 0}
            branch_map[br]["total"] += 1
            if s.get("studentId") in present_student_ids:
                branch_map[br]["present"] += 1

        branch_stats = []
        for br, b_data in sorted(branch_map.items()):
            b_tot = b_data["total"]
            b_pres = b_data["present"]
            b_pct = round((b_pres / b_tot * 100), 1) if b_tot > 0 else 0.0
            branch_stats.append({
                "branch": br,
                "total": b_tot,
                "present": b_pres,
                "absent": max(0, b_tot - b_pres),
                "percentage": b_pct
            })

        # Absent list for quick administrative review
        absent_list = []
        for s in all_students:
            if s.get("studentId") not in present_student_ids:
                absent_list.append({
                    "studentId": s.get("studentId"),
                    "name": s.get("name"),
                    "rollNumber": s.get("rollNumber"),
                    "branch": s.get("branch"),
                    "year": s.get("year"),
                    "section": s.get("section") or "-"
                })

        # Recent 10 attendance records
        recent_records = await att_coll.find({}).sort("createdAt", -1).limit(10).to_list(length=10)

        return {
            "totalStudents": total_students,
            "presentToday": present_today,
            "absentToday": absent_today,
            "attendancePercentage": pct,
            "branchStats": branch_stats,
            "absentStudents": absent_list[:10],
            "trend": trend,
            "weekly": weekly_chart,
            "recentAttendance": recent_records
        }

    @staticmethod
    async def get_daily_report(date_str: str, branch: Optional[str] = None) -> Dict[str, Any]:
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]

        student_query = {}
        if branch:
            student_query["branch"] = branch
        all_students = await students_coll.find(student_query).to_list(length=2000)
        total_students = len(all_students)

        att_query = {"date": date_str}
        if branch:
            att_query["branch"] = branch
        attendance_records = await att_coll.find(att_query).to_list(length=2000)

        present_map = {(r.get("studentId") or r.get("_id")): r for r in attendance_records}
        present_count = len(present_map)
        absent_count = max(0, total_students - present_count)
        pct = round((present_count / total_students * 100), 1) if total_students > 0 else 0.0

        details = []
        for s in all_students:
            st_id = s.get("studentId") or s.get("_id")
            is_present = st_id in present_map
            rec = present_map.get(st_id)
            details.append({
                "studentId": st_id,
                "name": s.get("name"),
                "rollNumber": s.get("rollNumber"),
                "branch": s.get("branch"),
                "status": "Present" if is_present else "Absent",
                "time": rec.get("time") if rec else "-",
                "confidence": rec.get("confidencePercent") if rec else None
            })

        return {
            "date": date_str,
            "branch": branch or "All Branches",
            "totalStudents": total_students,
            "present": present_count,
            "absent": absent_count,
            "percentage": pct,
            "students": details
        }

    @staticmethod
    async def get_monthly_report(year_month: str, branch: Optional[str] = None, mode: str = "active") -> Dict[str, Any]:
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]

        try:
            year, month_num = map(int, year_month.split("-"))
        except Exception:
            now = datetime.now()
            year, month_num = now.year, now.month
            year_month = f"{year:04d}-{month_num:02d}"

        _, days_in_month = calendar.monthrange(year, month_num)

        student_query = {}
        if branch and branch.upper() != "ALL":
            student_query["branch"] = branch
        all_students = await students_coll.find(student_query).to_list(length=5000)

        def sort_key(s):
            roll = str(s.get("rollNumber") or s.get("studentId") or "")
            digits = "".join(ch for ch in roll if ch.isdigit())
            num_val = int(digits) if digits else 99999999
            return (num_val, roll, str(s.get("name") or "").upper())

        all_students.sort(key=sort_key)

        att_query = {"date": {"$regex": f"^{year_month}"}}
        if branch and branch.upper() != "ALL":
            att_query["branch"] = branch
        all_att = await att_coll.find(att_query).to_list(length=50000)

        recorded_dates = sorted({r.get("date") for r in all_att if r.get("date")})

        if mode == "all_month":
            dates = [f"{year:04d}-{month_num:02d}-{d:02d}" for d in range(1, days_in_month + 1)]
        else:
            if recorded_dates:
                dates = recorded_dates
            else:
                now = datetime.now()
                max_day = days_in_month
                if year == now.year and month_num == now.month:
                    max_day = max(1, min(days_in_month, now.day))
                dates = [
                    f"{year:04d}-{month_num:02d}-{d:02d}"
                    for d in range(1, max_day + 1)
                    if datetime(year, month_num, d).weekday() < 6
                ]
                if not dates:
                    dates = [f"{year:04d}-{month_num:02d}-01"]

        num_dates = len(dates)

        present_set = set()
        for r in all_att:
            d = r.get("date")
            sid = str(r.get("studentId") or "").strip().lower()
            roll = str(r.get("rollNumber") or "").strip().lower()
            if sid and d:
                present_set.add((sid, d))
            if roll and d:
                present_set.add((roll, d))

        matrix_rows = []
        summary = []
        date_totals = {d: 0 for d in dates}

        for idx, s in enumerate(all_students, 1):
            sid = str(s.get("studentId") or s.get("_id") or "").strip()
            roll = str(s.get("rollNumber") or sid or "")
            sid_clean = sid.lower()
            roll_clean = roll.lower()

            p_count = 0
            student_att = {}
            for d in dates:
                is_p = (sid_clean, d) in present_set or (roll_clean, d) in present_set
                if is_p:
                    student_att[d] = "P"
                    p_count += 1
                    date_totals[d] += 1
                else:
                    student_att[d] = "A"

            absent_count = max(0, num_dates - p_count)
            pct = round((p_count / num_dates * 100), 1) if num_dates > 0 else 0.0

            matrix_rows.append({
                "sno": idx,
                "studentId": sid,
                "name": str(s.get("name") or "").upper(),
                "rollNumber": roll,
                "branch": s.get("branch") or "GENERAL",
                "attendance": student_att,
                "totalPresent": p_count,
                "percentage": pct
            })

            summary.append({
                "studentId": sid,
                "name": s.get("name"),
                "rollNumber": roll,
                "branch": s.get("branch"),
                "totalClasses": num_dates,
                "present": p_count,
                "absent": absent_count,
                "percentage": pct
            })

        month_name = calendar.month_name[month_num].upper()
        formatted_dates = []
        for d in dates:
            try:
                dt = datetime.strptime(d, "%Y-%m-%d")
                formatted_dates.append(f"{dt.day}/{dt.month}/{str(dt.year)[-2:]}")
            except Exception:
                formatted_dates.append(d)

        total_p_all = sum(date_totals.values())
        total_possible = len(all_students) * num_dates
        overall_pct = round((total_p_all / total_possible * 100), 1) if total_possible > 0 else 0.0

        return {
            "month": year_month,
            "branch": branch or "All Branches",
            "totalClasses": num_dates,
            "studentsCount": len(all_students),
            "summary": summary,
            "matrix": {
                "title": f"{month_name} ATTENDANCE",
                "dates": dates,
                "formattedDates": formatted_dates,
                "rows": matrix_rows,
                "dateTotals": date_totals,
                "totalPresentAll": total_p_all,
                "overallPercentage": overall_pct
            }
        }

    @staticmethod
    async def export_csv(filter_query: Dict[str, Any]) -> str:
        att_coll = db_manager["attendance"]
        records = await att_coll.find(filter_query).sort("date", -1).to_list(length=10000)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Time", "Student ID", "Name", "Roll Number", "Branch", "Status", "Confidence (%)", "Session ID"])
        for r in records:
            writer.writerow([
                r.get("date", ""),
                r.get("time", ""),
                r.get("studentId", ""),
                r.get("studentName", ""),
                r.get("rollNumber", ""),
                r.get("branch", ""),
                r.get("status", "Present"),
                r.get("confidencePercent", r.get("confidence", "")),
                r.get("sessionId", "")
            ])
        return output.getvalue()

    @staticmethod
    async def export_excel(filter_query: Dict[str, Any]) -> io.BytesIO:
        att_coll = db_manager["attendance"]
        records = await att_coll.find(filter_query).sort("date", -1).to_list(length=10000)

        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance Records"

        # Styling
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        regular_font = Font(name="Calibri", size=10)
        border_side = Side(style="thin", color="CBD5E1")
        cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)

        headers = ["Date", "Time", "Student ID", "Name", "Roll Number", "Branch", "Status", "Confidence (%)", "Session ID"]
        ws.append(headers)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        for r in records:
            ws.append([
                r.get("date", ""),
                r.get("time", ""),
                r.get("studentId", ""),
                r.get("studentName", ""),
                r.get("rollNumber", ""),
                r.get("branch", ""),
                r.get("status", "Present"),
                r.get("confidencePercent", r.get("confidence", "")),
                r.get("sessionId", "")
            ])

        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=len(headers)):
            for cell in row:
                cell.font = regular_font
                cell.border = cell_border
                cell.alignment = Alignment(vertical="center")

        # Auto adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    async def export_monthly_register_excel(
        month: str,
        branch: Optional[str] = None,
        mode: str = "active"
    ) -> io.BytesIO:
        """
        Generates the standard college/university monthly attendance ledger matrix (.xlsx)
        matching user's register image:
        Headers: S NO | ROLL NO | NAME | D1 | D2 | ... | TOTAL ATT. (N) | PERCENTAGE
        Rows: P (Present, blue) / A (Absent, red)
        """
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]

        # Parse year and month
        try:
            year, month_num = map(int, month.split("-"))
        except Exception:
            now = datetime.now()
            year, month_num = now.year, now.month
            month = f"{year:04d}-{month_num:02d}"

        _, days_in_month = calendar.monthrange(year, month_num)

        # 1. Fetch students
        student_query = {}
        if branch and branch.upper() != "ALL":
            student_query["branch"] = branch
        all_students = await students_coll.find(student_query).to_list(length=5000)

        # Natural sort by roll number or name
        def sort_key(s):
            roll = str(s.get("rollNumber") or s.get("studentId") or "")
            digits = "".join(ch for ch in roll if ch.isdigit())
            num_val = int(digits) if digits else 99999999
            return (num_val, roll, str(s.get("name") or "").upper())

        all_students.sort(key=sort_key)

        # 2. Fetch all attendance records for this month
        att_query = {"date": {"$regex": f"^{month}"}}
        if branch and branch.upper() != "ALL":
            att_query["branch"] = branch
        all_att = await att_coll.find(att_query).to_list(length=50000)

        # 3. Determine dates for columns
        recorded_dates = sorted({r.get("date") for r in all_att if r.get("date")})

        if mode == "all_month":
            dates = [f"{year:04d}-{month_num:02d}-{d:02d}" for d in range(1, days_in_month + 1)]
        else:  # "active" mode
            if recorded_dates:
                dates = recorded_dates
            else:
                # Fallback to weekdays up to today or for the month
                now = datetime.now()
                max_day = days_in_month
                if year == now.year and month_num == now.month:
                    max_day = max(1, min(days_in_month, now.day))
                dates = [
                    f"{year:04d}-{month_num:02d}-{d:02d}"
                    for d in range(1, max_day + 1)
                    if datetime(year, month_num, d).weekday() < 6  # Mon - Sat
                ]
                if not dates:
                    dates = [f"{year:04d}-{month_num:02d}-01"]

        num_dates = len(dates)

        # Map: set of (student_identifier, date)
        present_set = set()
        for r in all_att:
            d = r.get("date")
            sid = str(r.get("studentId") or "").strip().lower()
            roll = str(r.get("rollNumber") or "").strip().lower()
            if sid and d:
                present_set.add((sid, d))
            if roll and d:
                present_set.add((roll, d))

        # 4. Create Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = f"{calendar.month_abbr[month_num]} Attendance"
        ws.views.sheetView[0].showGridLines = True

        total_cols = 3 + num_dates + 2  # S NO, ROLL NO, NAME + dates + TOTAL ATT, PERCENTAGE

        thin_border = Border(
            left=Side(style="thin", color="000000"),
            right=Side(style="thin", color="000000"),
            top=Side(style="thin", color="000000"),
            bottom=Side(style="thin", color="000000"),
        )

        # Title Row (Row 1)
        month_name = calendar.month_name[month_num].upper()
        if branch and branch.upper() != "ALL":
            title_text = f"{month_name} {year} ATTENDANCE - {branch.upper()} DEPARTMENT"
        else:
            title_text = f"{month_name} ATTENDANCE"

        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
        title_cell = ws.cell(row=1, column=1, value=title_text)
        title_cell.font = Font(name="Calibri", size=12, bold=True)
        title_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 28

        for c_idx in range(1, total_cols + 1):
            ws.cell(row=1, column=c_idx).border = thin_border

        # Headers Row (Row 2)
        headers = ["S NO", "ROLL NO", "NAME"]
        for d in dates:
            try:
                dt = datetime.strptime(d, "%Y-%m-%d")
                headers.append(f"{dt.day}/{dt.month}/{str(dt.year)[-2:]}")
            except Exception:
                headers.append(d)
        headers.append(f"TOTAL ATT. ({num_dates})")
        headers.append("PERCENTAGE")

        ws.row_dimensions[2].height = 26
        header_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for col_idx, h in enumerate(headers, 1):
            cell = ws.cell(row=2, column=col_idx, value=h)
            cell.font = Font(name="Calibri", size=10, bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = thin_border
            cell.fill = header_fill

        # Data Rows (Row 3 onwards)
        p_font = Font(name="Calibri", size=10, bold=True, color="0284C7")  # Cyan/Blue P
        a_font = Font(name="Calibri", size=10, bold=True, color="DC2626")  # Red A
        reg_font = Font(name="Calibri", size=10)
        bold_font = Font(name="Calibri", size=10, bold=True)

        date_col_totals = [0] * num_dates
        current_row = 3

        for idx, student in enumerate(all_students, 1):
            ws.row_dimensions[current_row].height = 20

            # S NO
            c_sno = ws.cell(row=current_row, column=1, value=idx)
            c_sno.alignment = Alignment(horizontal="center", vertical="center")
            c_sno.border = thin_border
            c_sno.font = reg_font

            # ROLL NO
            roll_str = str(student.get("rollNumber") or student.get("studentId") or "")
            c_roll = ws.cell(row=current_row, column=2, value=roll_str)
            c_roll.alignment = Alignment(horizontal="center", vertical="center")
            c_roll.border = thin_border
            c_roll.font = reg_font
            c_roll.number_format = "@"

            # NAME
            name_str = str(student.get("name") or "").upper()
            c_name = ws.cell(row=current_row, column=3, value=name_str)
            c_name.alignment = Alignment(horizontal="left", vertical="center")
            c_name.border = thin_border
            c_name.font = bold_font

            sid = str(student.get("studentId") or "").strip().lower()
            roll_clean = roll_str.strip().lower()

            p_count = 0
            for d_idx, d in enumerate(dates):
                col_num = 4 + d_idx
                c_att = ws.cell(row=current_row, column=col_num)
                c_att.border = thin_border
                c_att.alignment = Alignment(horizontal="center", vertical="center")

                is_present = (sid, d) in present_set or (roll_clean, d) in present_set
                if is_present:
                    c_att.value = "P"
                    c_att.font = p_font
                    p_count += 1
                    date_col_totals[d_idx] += 1
                else:
                    c_att.value = "A"
                    c_att.font = a_font

            pct = round((p_count / num_dates * 100), 1) if num_dates > 0 else 0
            pct_display = int(pct) if pct.is_integer() else pct

            # TOTAL ATT.
            c_tot = ws.cell(row=current_row, column=4 + num_dates, value=p_count)
            c_tot.border = thin_border
            c_tot.alignment = Alignment(horizontal="center", vertical="center")
            c_tot.font = bold_font

            # PERCENTAGE
            c_pct = ws.cell(row=current_row, column=5 + num_dates, value=pct_display)
            c_pct.border = thin_border
            c_pct.alignment = Alignment(horizontal="center", vertical="center")
            c_pct.font = bold_font

            current_row += 1

        # Summary Row at the Bottom
        if len(all_students) > 0:
            ws.row_dimensions[current_row].height = 22
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=3)
            summary_label = ws.cell(row=current_row, column=1, value="TOTAL PRESENT")
            summary_label.alignment = Alignment(horizontal="center", vertical="center")
            summary_label.font = Font(name="Calibri", size=10, bold=True)
            summary_label.fill = header_fill

            for c_idx in range(1, 4):
                ws.cell(row=current_row, column=c_idx).border = thin_border

            total_attendance_all = sum(date_col_totals)
            for d_idx in range(num_dates):
                col_num = 4 + d_idx
                c_sum = ws.cell(row=current_row, column=col_num, value=date_col_totals[d_idx])
                c_sum.border = thin_border
                c_sum.alignment = Alignment(horizontal="center", vertical="center")
                c_sum.font = bold_font
                c_sum.fill = header_fill

            # Overall Total attendance cell
            c_tot_sum = ws.cell(row=current_row, column=4 + num_dates, value=total_attendance_all)
            c_tot_sum.border = thin_border
            c_tot_sum.alignment = Alignment(horizontal="center", vertical="center")
            c_tot_sum.font = bold_font
            c_tot_sum.fill = header_fill

            # Overall turnout percentage
            total_possible = len(all_students) * num_dates
            avg_pct = round((total_attendance_all / total_possible * 100), 1) if total_possible > 0 else 0
            avg_pct_display = int(avg_pct) if avg_pct.is_integer() else avg_pct
            c_avg_pct = ws.cell(row=current_row, column=5 + num_dates, value=f"{avg_pct_display}%")
            c_avg_pct.border = thin_border
            c_avg_pct.alignment = Alignment(horizontal="center", vertical="center")
            c_avg_pct.font = bold_font
            c_avg_pct.fill = header_fill

        # Auto adjust column widths
        ws.column_dimensions["A"].width = 7
        ws.column_dimensions["B"].width = 18
        ws.column_dimensions["C"].width = 28
        for d_idx in range(num_dates):
            col_letter = get_column_letter(4 + d_idx)
            ws.column_dimensions[col_letter].width = 9.5
        ws.column_dimensions[get_column_letter(4 + num_dates)].width = 15
        ws.column_dimensions[get_column_letter(5 + num_dates)].width = 14

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    async def export_monthly_register_csv(
        month: str,
        branch: Optional[str] = None,
        mode: str = "active"
    ) -> str:
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]

        try:
            year, month_num = map(int, month.split("-"))
        except Exception:
            now = datetime.now()
            year, month_num = now.year, now.month
            month = f"{year:04d}-{month_num:02d}"

        _, days_in_month = calendar.monthrange(year, month_num)

        student_query = {}
        if branch and branch.upper() != "ALL":
            student_query["branch"] = branch
        all_students = await students_coll.find(student_query).to_list(length=5000)

        def sort_key(s):
            roll = str(s.get("rollNumber") or s.get("studentId") or "")
            digits = "".join(ch for ch in roll if ch.isdigit())
            num_val = int(digits) if digits else 99999999
            return (num_val, roll, str(s.get("name") or "").upper())

        all_students.sort(key=sort_key)

        att_query = {"date": {"$regex": f"^{month}"}}
        if branch and branch.upper() != "ALL":
            att_query["branch"] = branch
        all_att = await att_coll.find(att_query).to_list(length=50000)

        recorded_dates = sorted({r.get("date") for r in all_att if r.get("date")})
        if mode == "all_month":
            dates = [f"{year:04d}-{month_num:02d}-{d:02d}" for d in range(1, days_in_month + 1)]
        else:
            if recorded_dates:
                dates = recorded_dates
            else:
                now = datetime.now()
                max_day = days_in_month
                if year == now.year and month_num == now.month:
                    max_day = max(1, min(days_in_month, now.day))
                dates = [
                    f"{year:04d}-{month_num:02d}-{d:02d}"
                    for d in range(1, max_day + 1)
                    if datetime(year, month_num, d).weekday() < 6
                ]
                if not dates:
                    dates = [f"{year:04d}-{month_num:02d}-01"]

        num_dates = len(dates)

        present_set = set()
        for r in all_att:
            d = r.get("date")
            sid = str(r.get("studentId") or "").strip().lower()
            roll = str(r.get("rollNumber") or "").strip().lower()
            if sid and d:
                present_set.add((sid, d))
            if roll and d:
                present_set.add((roll, d))

        output = io.StringIO()
        writer = csv.writer(output)

        month_name = calendar.month_name[month_num].upper()
        title_text = f"{month_name} ATTENDANCE"
        if branch and branch.upper() != "ALL":
            title_text += f" - {branch.upper()} DEPARTMENT"
        writer.writerow([title_text])

        headers = ["S NO", "ROLL NO", "NAME"]
        for d in dates:
            try:
                dt = datetime.strptime(d, "%Y-%m-%d")
                headers.append(f"{dt.day}/{dt.month}/{str(dt.year)[-2:]}")
            except Exception:
                headers.append(d)
        headers.append(f"TOTAL ATT. ({num_dates})")
        headers.append("PERCENTAGE")
        writer.writerow(headers)

        for idx, student in enumerate(all_students, 1):
            roll_str = str(student.get("rollNumber") or student.get("studentId") or "")
            name_str = str(student.get("name") or "").upper()
            sid = str(student.get("studentId") or "").strip().lower()
            roll_clean = roll_str.strip().lower()

            row = [idx, roll_str, name_str]
            p_count = 0
            for d in dates:
                if (sid, d) in present_set or (roll_clean, d) in present_set:
                    row.append("P")
                    p_count += 1
                else:
                    row.append("A")

            pct = round((p_count / num_dates * 100), 1) if num_dates > 0 else 0
            pct_display = int(pct) if pct.is_integer() else pct
            row.append(p_count)
            row.append(pct_display)
            writer.writerow(row)

        return output.getvalue()

report_service = ReportService()
