from datetime import datetime
import logging
import re
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import db_manager
from app.services.attendance_service import attendance_service
from app.services.face_recognition import face_service

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

    # Process each detected face
    marked_students = []
    already_marked = []
    unknown_faces = 0

    for rec in recognition_results:
        if rec.get("recognized"):
            st = rec["student"]
            mark_res = await attendance_service.mark_attendance(
                student_id=st["id"],
                confidence=rec["confidence"],
                session_id=payload.sessionId
            )
            if mark_res.get("success"):
                marked_students.append({
                    "student": st,
                    "confidence": rec["confidence"],
                    "confidencePercent": rec["confidencePercent"],
                    "markedAt": mark_res["attendance"]["time"],
                    "status": "marked"
                })
            elif mark_res.get("status") == "already_marked":
                already_marked.append({
                    "student": st,
                    "confidence": rec["confidence"],
                    "markedAt": mark_res.get("markedAt"),
                    "status": "already_marked"
                })
        else:
            unknown_faces += 1

    return {
        "facesDetected": len(recognition_results),
        "results": recognition_results,
        "markedCount": len(marked_students),
        "markedStudents": marked_students,
        "alreadyMarked": already_marked,
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
