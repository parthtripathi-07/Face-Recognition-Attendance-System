from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import uuid
from zoneinfo import ZoneInfo
from fastapi import HTTPException, status
from app.config import settings
from app.database import db_manager

logger = logging.getLogger("faceattend.attendance_service")

# In-memory cooldown cache: { "studentId": last_marked_timestamp }
_COOLDOWN_CACHE: Dict[str, float] = {}

class AttendanceService:
    @staticmethod
    def get_server_datetime():
        """Generates server-side timestamp adhering to configured timezone."""
        try:
            tz = ZoneInfo(settings.TIMEZONE)
            now = datetime.now(tz)
        except Exception:
            now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%I:%M:%S %p")
        iso_str = now.isoformat()
        return date_str, time_str, iso_str, now.timestamp()

    @staticmethod
    async def mark_attendance(
        student_id: str,
        confidence: float,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        students_coll = db_manager["students"]
        att_coll = db_manager["attendance"]
        date_str, time_str, iso_str, current_ts = AttendanceService.get_server_datetime()

        # Cooldown check
        last_time = _COOLDOWN_CACHE.get(student_id, 0)
        if (current_ts - last_time) < settings.COOLDOWN_SECONDS:
            return {
                "success": False,
                "status": "cooldown",
                "message": f"Student {student_id} recognized recently. Cooldown active ({int(settings.COOLDOWN_SECONDS - (current_ts - last_time))}s remaining).",
                "studentId": student_id
            }

        student = await students_coll.find_one({
            "$or": [
                {"studentId": student_id},
                {"rollNumber": student_id},
                {"rollNumber": student_id.upper()},
                {"_id": student_id}
            ]
        })
        if not student:
            return {
                "success": False,
                "status": "not_found",
                "message": f"Student '{student_id}' does not exist in the records."
            }

        st_id = student["studentId"]
        st_name = student.get("name", "Student")
        roll_no = student.get("rollNumber", "")
        branch = student.get("branch", "")
        year = student.get("year", "")
        section = student.get("section", "")

        # Check existing attendance for today
        query = {
            "studentId": st_id,
            "date": date_str
        }
        if session_id:
            query["sessionId"] = session_id

        existing = await att_coll.find_one(query)
        if existing and not settings.ALLOW_DUPLICATE_SAME_DAY:
            _COOLDOWN_CACHE[st_id] = current_ts
            return {
                "success": False,
                "status": "already_marked",
                "message": f"Attendance already marked today for {st_name} ({roll_no}).",
                "student": {
                    "studentId": st_id,
                    "name": st_name,
                    "rollNumber": roll_no,
                    "branch": branch
                },
                "markedAt": existing.get("time"),
                "date": date_str
            }

        # Create new attendance record
        att_doc = {
            "_id": uuid.uuid4().hex,
            "studentId": st_id,
            "studentName": st_name,
            "rollNumber": roll_no,
            "branch": branch,
            "year": year,
            "section": section,
            "date": date_str,
            "time": time_str,
            "status": "Present",
            "confidence": round(confidence, 3),
            "confidencePercent": round(confidence * 100, 1),
            "sessionId": session_id or f"GEN-{date_str}",
            "createdAt": iso_str
        }

        await att_coll.insert_one(att_doc)
        _COOLDOWN_CACHE[st_id] = current_ts

        logger.info(f"Attendance marked: {st_name} ({roll_no}) at {time_str}")

        return {
            "success": True,
            "status": "marked",
            "message": f"Attendance marked successfully for {st_name} ({roll_no}) at {time_str}.",
            "attendance": {
                "id": att_doc["_id"],
                "studentId": st_id,
                "studentName": st_name,
                "rollNumber": roll_no,
                "branch": branch,
                "date": date_str,
                "time": time_str,
                "status": "Present",
                "confidence": round(confidence, 3),
                "confidencePercent": round(confidence * 100, 1),
                "sessionId": att_doc["sessionId"]
            }
        }

attendance_service = AttendanceService()
