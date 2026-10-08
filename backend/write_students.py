from pathlib import Path

content = '''from datetime import datetime
from typing import List, Optional
import uuid
import re
from fastapi import APIRouter, HTTPException, Query, status
from app.database import db_manager
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate

router = APIRouter(prefix="/api/students", tags=["Students"])

async def generate_student_id() -> str:
    students_coll = db_manager["students"]
    count = await students_coll.count_documents({})
    candidate_num = count + 1
    while True:
        candidate_id = f"ST{candidate_num:03d}"
        existing = await students_coll.find_one({"studentId": candidate_id})
        if not existing:
            return candidate_id
        candidate_num += 1

def format_student(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id", "")),
        "studentId": doc.get("studentId", ""),
        "name": doc.get("name", ""),
        "rollNumber": doc.get("rollNumber", ""),
        "email": doc.get("email"),
        "phone": doc.get("phone"),
        "branch": doc.get("branch", ""),
        "year": doc.get("year", ""),
        "section": doc.get("section"),
        "faceRegistered": doc.get("faceRegistered", False),
        "samplesCount": doc.get("samplesCount", 0),
        "createdAt": doc.get("createdAt", datetime.utcnow().isoformat()),
        "updatedAt": doc.get("updatedAt")
    }

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(payload: StudentCreate):
    students_coll = db_manager["students"]
    
    existing_roll = await students_coll.find_one({
        "rollNumber": {"$regex": f"^{re.escape(payload.rollNumber.strip())}$", "$options": "i"}
    })
    if existing_roll:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Student with Roll Number "{payload.rollNumber}" already exists.'
        )

    student_id = payload.studentId.strip() if payload.studentId else await generate_student_id()
    existing_id = await students_coll.find_one({"studentId": student_id})
    if existing_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Student with Student ID "{student_id}" already exists.'
        )

    now = datetime.utcnow().isoformat()
    student_doc = {
        "_id": uuid.uuid4().hex,
        "studentId": student_id,
        "name": payload.name.strip(),
        "rollNumber": payload.rollNumber.strip().upper(),
        "email": payload.email.strip().lower() if payload.email else None,
        "phone": payload.phone.strip() if payload.phone else None,
        "branch": payload.branch.strip().upper(),
        "year": payload.year.strip(),
        "section": payload.section.strip().upper() if payload.section else None,
        "faceRegistered": False,
        "samplesCount": 0,
        "createdAt": now,
        "updatedAt": now
    }

    await students_coll.insert_one(student_doc)
    return format_student(student_doc)

@router.get("")
async def list_students(
    search: Optional[str] = Query(None, description="Search across name, roll number, student ID, email"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    year: Optional[str] = Query(None, description="Filter by year"),
    faceRegistered: Optional[bool] = Query(None, description="Filter by face registration status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    students_coll = db_manager["students"]
    query = {}

    if branch:
        query["branch"] = {"$regex": f"^{re.escape(branch.strip())}$", "$options": "i"}
    if year:
        query["year"] = {"$regex": f"^{re.escape(year.strip())}$", "$options": "i"}
    if faceRegistered is not None:
        query["faceRegistered"] = faceRegistered

    if search and search.strip():
        s = re.escape(search.strip())
        query["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"rollNumber": {"$regex": s, "$options": "i"}},
            {"studentId": {"$regex": s, "$options": "i"}},
            {"email": {"$regex": s, "$options": "i"}}
        ]

    total = await students_coll.count_documents(query)
    cursor = students_coll.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return {
        "students": [format_student(d) for d in docs],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{id_or_studentid}", response_model=StudentResponse)
async def get_student(id_or_studentid: str):
    students_coll = db_manager["students"]
    doc = await students_coll.find_one({
        "$or": [
            {"_id": id_or_studentid},
            {"studentId": id_or_studentid},
            {"rollNumber": id_or_studentid.upper()}
        ]
    })
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{id_or_studentid}" not found.'
        )
    return format_student(doc)

@router.put("/{id_or_studentid}", response_model=StudentResponse)
async def update_student(id_or_studentid: str, payload: StudentUpdate):
    students_coll = db_manager["students"]
    doc = await students_coll.find_one({
        "$or": [
            {"_id": id_or_studentid},
            {"studentId": id_or_studentid}
        ]
    })
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{id_or_studentid}" not found.'
        )

    update_fields = {}
    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.rollNumber is not None:
        new_roll = payload.rollNumber.strip().upper()
        existing = await students_coll.find_one({
            "rollNumber": {"$regex": f"^{re.escape(new_roll)}$", "$options": "i"},
            "_id": {"$ne": doc["_id"]}
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Roll Number "{new_roll}" is already assigned to another student.'
            )
        update_fields["rollNumber"] = new_roll
    if payload.email is not None:
        update_fields["email"] = payload.email.strip().lower()
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.branch is not None:
        update_fields["branch"] = payload.branch.strip().upper()
    if payload.year is not None:
        update_fields["year"] = payload.year.strip()
    if payload.section is not None:
        update_fields["section"] = payload.section.strip().upper()

    if update_fields:
        update_fields["updatedAt"] = datetime.utcnow().isoformat()
        await students_coll.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        doc.update(update_fields)

    return format_student(doc)

@router.delete("/{id_or_studentid}", status_code=status.HTTP_200_OK)
async def delete_student(id_or_studentid: str):
    students_coll = db_manager["students"]
    faces_coll = db_manager["face_embeddings"]
    att_coll = db_manager["attendance"]

    doc = await students_coll.find_one({
        "$or": [
            {"_id": id_or_studentid},
            {"studentId": id_or_studentid}
        ]
    })
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{id_or_studentid}" not found.'
        )

    student_id = doc["studentId"]
    await students_coll.delete_one({"_id": doc["_id"]})
    await faces_coll.delete_many({"studentId": student_id})
    await att_coll.delete_many({"studentId": student_id})

    return {
        "success": True,
        "message": f'Student "{doc.get("name")}" ({student_id}) and associated face data were deleted successfully.'
    }
'''

target = Path(__file__).resolve().parent / "app" / "routes" / "students.py"
target.write_text(content, encoding="utf-8")
print("WROTE STUDENTS ROUTE SUCCESSFULLY! Size:", target.stat().st_size)
