from datetime import datetime
import logging
import re
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import db_manager
from app.services.attendance_service import attendance_service, AttendanceService
from app.services.face_recognition import face_service
from app.services.liveness_service import liveness_service

logger = logging.getLogger("faceattend.routes.attendance")
router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

class MarkAttendancePayload(BaseModel):
    studentId: str = Field(..., description="Student ID or Roll Number")
    confidence: float = Field(..., ge=0.0, le=1.0)
    sessionId: Optional[str] = None

class RecognizeAndMarkPayload(BaseModel):
    image: str = Field(..., description="Base64 encoded webcam frame")
    sessionId: Optional[str] = None
    threshold: Optional[float] = None

class CreateSessionPayload(BaseModel):
    subject: str = Field(..., min_length=2, max_length=100)
    branch: str = Field(..., min_length=1, max_length=50)
    year: str = Field(..., min_length=1, max_length=50)
    section: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None

@router.post("/mark")
async def mark_attendance(payload: MarkAttendancePayload):
    logger.info(f"[ATTENDANCE_MANUAL] Manual roll call check-in requested for studentId={payload.studentId}, confidence={payload.confidence}")
    result = await attendance_service.mark_attendance(
        student_id=payload.studentId,
        confidence=payload.confidence,
        session_id=payload.sessionId
    )
    if not result.get("success") and result.get("status") == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("message")
        )
    return result

@router.post("/recognize-and-mark")
async def recognize_and_mark(payload: RecognizeAndMarkPayload):
    """Real-time convenience endpoint: detects, recognizes, and automatically marks attendance in 1 call."""
    try:
        img = face_service.decode_image(payload.image)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(e)}"
        )

    faces_coll = db_manager["face_embeddings"]
    cursor = faces_coll.find({})
    registered_faces = await cursor.to_list(length=1000)

    threshold = payload.threshold or settings.RECOGNITION_THRESHOLD
    recognition_results = face_service.recognize_frame(img, registered_faces, threshold=threshold)

    if not recognition_results:
        return {
            "facesDetected": 0,
            "recognized": False,
            "message": "No face detected in camera frame.",
            "results": []
        }

    # Process each detected face with Liveness & Eye-Blink verification
    marked_students = []
    already_marked = []
    awaiting_blink = []
    spoof_detected = []
    unknown_faces = 0

    date_str, _, _, _ = AttendanceService.get_server_datetime()
    att_coll = db_manager["attendance"]

    for rec in recognition_results:
        st_id = rec["student"]["id"] if rec.get("recognized") else None
        liveness_data = liveness_service.process_face_liveness(img, rec, student_id=st_id)
        rec["liveness"] = liveness_data

        if rec.get("recognized"):
            st = rec["student"]

            # 1. Anti-Spoofing and Liveness Verification
            if settings.LIVENESS_ENABLED:
                if liveness_data.get("is_spoof"):
                    logger.warning(
                        f"[ATTENDANCE_REJECT] Presentation attack / spoof rejected for {st.get('name')} "
                        f"({st.get('id')}): {liveness_data.get('spoof_reason')}"
                    )
                    spoof_detected.append({
                        "student": st,
                        "confidence": rec["confidence"],
                        "confidencePercent": rec["confidencePercent"],
                        "reason": liveness_data.get("spoof_reason"),
                        "message": liveness_data.get("prompt"),
                        "status": "spoof_rejected"
                    })
                    continue

                is_verified = (
                    liveness_data.get("is_live") is True
                    and liveness_data.get("blink_verified") is True
                    and liveness_data.get("blinks_count", 0) >= 2
                )

                if settings.REQUIRE_EYE_BLINK and not is_verified:
                    logger.info(
                        f"[ATTENDANCE_AWAIT] Student {st.get('name')} ({st.get('id')}): "
                        f"Liveness status={liveness_data.get('liveness_status')}, "
                        f"blinks={liveness_data.get('blinks_count', 0)}/{liveness_data.get('required_blinks', 2)}"
                    )
                    awaiting_blink.append({
                        "student": st,
                        "confidence": rec["confidence"],
                        "confidencePercent": rec["confidencePercent"],
                        "eyeState": liveness_data.get("eye_state"),
                        "eyeOpenness": liveness_data.get("eye_openness"),
                        "blinksCount": liveness_data.get("blinks_count", 0),
                        "requiredBlinks": liveness_data.get("required_blinks", 2),
                        "livenessStatus": liveness_data.get("liveness_status"),
                        "message": liveness_data.get("prompt"),
                        "status": "awaiting_blink"
                    })
                    continue

            # 2. Live 2-Blink Verification Passed: Check if already marked today
            logger.info(
                f"[ATTENDANCE_DECISION] LIVENESS VERIFIED (2/2 distinct blinks) for {st.get('name')} "
                f"({st.get('id')}) with recognition confidence {rec['confidence']:.3f}. Checking duplicate."
            )

            existing_query = {"studentId": st["id"], "date": date_str}
            if payload.sessionId:
                existing_query["sessionId"] = payload.sessionId
            existing = await att_coll.find_one(existing_query)

            if existing and not settings.ALLOW_DUPLICATE_SAME_DAY:
                liveness_service.reset_student_tracker(st["id"])
                logger.info(f"[ATTENDANCE_DUPLICATE] Student {st.get('name')} already marked today at {existing.get('time')}.")
                already_marked.append({
                    "student": st,
                    "confidence": rec["confidence"],
                    "confidencePercent": rec["confidencePercent"],
                    "markedAt": existing.get("time"),
                    "liveness": "verified",
                    "status": "already_marked",
                    "message": f"2 Eye blinks verified! But attendance already recorded today at {existing.get('time')}."
                })
                continue

            # 3. Mark New Attendance!
            mark_res = await attendance_service.mark_attendance(
                student_id=st["id"],
                confidence=rec["confidence"],
                session_id=payload.sessionId
            )
            # Reset tracker immediately so no photo can ever reuse previous verification
            liveness_service.reset_student_tracker(st["id"])

            if mark_res.get("success"):
                logger.info(
                    f"[ATTENDANCE_SAVED] SUCCESS: Attendance recorded for {st.get('name')} "
                    f"({st.get('rollNumber')}) at {mark_res['attendance']['time']}"
                )
                marked_students.append({
                    "student": st,
                    "confidence": rec["confidence"],
                    "confidencePercent": rec["confidencePercent"],
                    "markedAt": mark_res["attendance"]["time"],
                    "liveness": "verified",
                    "status": "marked"
                })
            elif mark_res.get("status") == "already_marked":
                logger.info(f"[ATTENDANCE_ALREADY] Student {st.get('name')} already recorded at {mark_res.get('markedAt')}.")
                already_marked.append({
                    "student": st,
                    "confidence": rec["confidence"],
                    "confidencePercent": rec["confidencePercent"],
                    "markedAt": mark_res.get("markedAt"),
                    "liveness": "verified",
                    "status": "already_marked",
                    "message": f"Already marked today at {mark_res.get('markedAt')}."
                })
        else:
            unknown_faces += 1

    return {
        "facesDetected": len(recognition_results),
        "results": recognition_results,
        "markedCount": len(marked_students),
        "markedStudents": marked_students,
        "alreadyMarked": already_marked,
        "awaitingBlink": awaiting_blink,
        "spoofDetected": spoof_detected,
        "unknownCount": unknown_faces
    }

@router.get("")
async def get_attendance_history(
    date: Optional[str] = Query(None, description="Exact date YYYY-MM-DD"),
    startDate: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    endDate: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    branch: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    studentId: Optional[str] = Query(None),
    sessionId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    att_coll = db_manager["attendance"]
    query: Dict[str, Any] = {}

    if date:
        query["date"] = date
    elif startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    elif startDate:
        query["date"] = {"$gte": startDate}
    elif endDate:
        query["date"] = {"$lte": endDate}

    if branch:
        query["branch"] = {"$regex": f"^{re.escape(branch.strip())}$", "$options": "i"}
    if year:
        query["year"] = {"$regex": f"^{re.escape(year.strip())}$", "$options": "i"}
    if section:
        query["section"] = {"$regex": f"^{re.escape(section.strip())}$", "$options": "i"}
    if studentId:
        query["studentId"] = studentId
    if sessionId:
        query["sessionId"] = sessionId

    if search and search.strip():
        s = re.escape(search.strip())
        query["$or"] = [
            {"studentName": {"$regex": s, "$options": "i"}},
            {"rollNumber": {"$regex": s, "$options": "i"}},
            {"studentId": {"$regex": s, "$options": "i"}}
        ]

    total = await att_coll.count_documents(query)
    cursor = att_coll.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return {
        "attendance": docs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/today")
async def get_today_attendance():
    att_coll = db_manager["attendance"]
    students_coll = db_manager["students"]

    date_str, _, _, _ = attendance_service.get_server_datetime()
    today_records = await att_coll.find({"date": date_str}).sort("createdAt", -1).to_list(length=1000)

    total_students = await students_coll.count_documents({})
    present_today = len(today_records)
    absent_today = max(0, total_students - present_today)
    pct = round((present_today / total_students * 100), 1) if total_students > 0 else 0.0

    return {
        "date": date_str,
        "totalStudents": total_students,
        "presentToday": present_today,
        "absentToday": absent_today,
        "attendancePercentage": pct,
        "records": today_records
    }

@router.delete("/today")
async def clear_today_attendance():
    """Clear today's attendance records (for testing or reset)."""
    att_coll = db_manager["attendance"]
    date_str, _, _, _ = AttendanceService.get_server_datetime()
    res = await att_coll.delete_many({"date": date_str})
    return {
        "success": True,
        "deletedCount": res.deleted_count,
        "message": f"Cleared {res.deleted_count} attendance records for today ({date_str})."
    }

@router.delete("/student/{student_id}/today")
async def clear_student_today_attendance(student_id: str):
    """Clear a single student's attendance for today so they can test check-in again."""
    att_coll = db_manager["attendance"]
    date_str, _, _, _ = AttendanceService.get_server_datetime()
    res = await att_coll.delete_many({
        "studentId": student_id.strip(),
        "date": date_str
    })
    return {
        "success": True,
        "deletedCount": res.deleted_count,
        "message": f"Reset today's attendance for student {student_id}."
    }

@router.get("/student/{student_id}")
async def get_student_attendance(student_id: str):
    att_coll = db_manager["attendance"]
    students_coll = db_manager["students"]

    clean_q = student_id.strip()
    student = await students_coll.find_one({
        "$or": [
            {"studentId": {"$regex": f"^{re.escape(clean_q)}$", "$options": "i"}},
            {"rollNumber": {"$regex": f"^{re.escape(clean_q)}$", "$options": "i"}},
            {"_id": clean_q}
        ]
    })
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student with Roll No or ID "{clean_q}" not found.'
        )

    st_id = student["studentId"]
    records = await att_coll.find({"studentId": st_id}).sort("date", -1).to_list(length=500)

    date_str, _, _, _ = attendance_service.get_server_datetime()
    today_record = next((r for r in records if r.get("date") == date_str), None)

    return {
        "student": {
            "studentId": st_id,
            "name": student.get("name"),
            "rollNumber": student.get("rollNumber"),
            "branch": student.get("branch"),
            "year": student.get("year"),
            "faceRegistered": bool(student.get("faceRegistered"))
        },
        "todayDate": date_str,
        "isMarkedToday": today_record is not None,
        "todayRecord": today_record,
        "totalPresent": len(records),
        "history": records[:20]
    }

# ----------------- Session Routes -----------------

@router.post("/sessions")
async def create_session(payload: CreateSessionPayload):
    sessions_coll = db_manager["sessions"]
    date_str, time_str, iso_str, _ = attendance_service.get_server_datetime()

    count = await sessions_coll.count_documents({"date": date_str})
    session_id = f"ATT-{date_str}-{count + 1:03d}"

    session_doc = {
        "_id": uuid.uuid4().hex,
        "sessionId": session_id,
        "subject": payload.subject.strip(),
        "branch": payload.branch.strip().upper(),
        "year": payload.year.strip(),
        "section": payload.section.strip().upper() if payload.section else "ALL",
        "date": date_str,
        "startTime": payload.startTime or time_str,
        "endTime": payload.endTime,
        "status": "active",
        "createdAt": iso_str
    }

    # Deactivate existing active sessions in this branch
    await sessions_coll.update_one(
        {"branch": session_doc["branch"], "status": "active"},
        {"$set": {"status": "completed", "updatedAt": iso_str}}
    )

    await sessions_coll.insert_one(session_doc)
    return session_doc

@router.get("/sessions/active")
async def get_active_session():
    sessions_coll = db_manager["sessions"]
    active = await sessions_coll.find_one({"status": "active"})
    return {"activeSession": active}

@router.post("/sessions/{session_id}/end")
async def end_session(session_id: str):
    sessions_coll = db_manager["sessions"]
    _, _, iso_str, _ = attendance_service.get_server_datetime()
    res = await sessions_coll.update_one(
        {"sessionId": session_id},
        {"$set": {"status": "completed", "updatedAt": iso_str}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"success": True, "message": f"Session {session_id} ended."}

@router.get("/sessions")
async def list_sessions(limit: int = Query(20, ge=1, le=100)):
    sessions_coll = db_manager["sessions"]
    cursor = sessions_coll.find({}).sort("createdAt", -1).limit(limit)
    sessions = await cursor.to_list(length=limit)
    return {"sessions": sessions}
