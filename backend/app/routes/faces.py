import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
import numpy as np

from app.database import db_manager
from app.services.face_recognition import face_service

logger = logging.getLogger("faceattend.faces")
router = APIRouter(prefix="/api/faces", tags=["Face Registration"])

class SingleSamplePayload(BaseModel):
    image: str = Field(..., description="Base64 encoded camera frame")

class RegisterFacesPayload(BaseModel):
    samples: List[str] = Field(..., min_length=1, max_length=15, description="List of 1 to 15 base64 encoded face images")

@router.post("/register/{student_id}")
async def register_student_face(student_id: str, payload: RegisterFacesPayload):
    students_coll = db_manager["students"]
    faces_coll = db_manager["face_embeddings"]

    student = await students_coll.find_one({
        "$or": [
            {"studentId": student_id},
            {"_id": student_id}
        ]
    })
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{student_id}" not found.'
        )

    st_id = student["studentId"]
    sample_embeddings = []
    processed_count = 0

    for idx, sample_b64 in enumerate(payload.samples):
        try:
            img = face_service.decode_image(sample_b64)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sample {idx + 1} corrupted or invalid format: {str(e)}"
            )

        detected = face_service.detect_faces(img)
        if len(detected) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sample {idx + 1}: No face detected. Please ensure your face is directly facing the camera."
            )
        if len(detected) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sample {idx + 1}: Multiple faces detected ({len(detected)}). Only one person must be visible."
            )

        face_info = detected[0]
        x, y, w, h = face_info["bbox"]
        crop = img[y:y+h, x:x+w]
        is_valid, quality, quality_msg = face_service.check_face_quality(crop)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sample {idx + 1}: Quality issue - {quality_msg}"
            )

        emb = face_service.generate_embedding(img, face_info)
        sample_embeddings.append(emb)
        processed_count += 1

    if not sample_embeddings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid face samples could be processed."
        )

    # Compute centroid embedding and normalize
    emb_array = np.array(sample_embeddings, dtype=np.float32)
    centroid = np.mean(emb_array, axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 1e-6:
        centroid = centroid / norm
    final_embedding = centroid.tolist()

    now = datetime.utcnow().isoformat()
    # Update or insert face embedding
    await faces_coll.update_one(
        {"studentId": st_id},
        {
            "$set": {
                "studentId": st_id,
                "studentName": student.get("name"),
                "rollNumber": student.get("rollNumber"),
                "branch": student.get("branch"),
                "year": student.get("year"),
                "embedding": final_embedding,
                "model": face_service.model_status,
                "samplesCount": processed_count,
                "updatedAt": now
            }
        },
        upsert=True
    )

    # Mark student faceRegistered = True
    await students_coll.update_one(
        {"studentId": st_id},
        {
            "$set": {
                "faceRegistered": True,
                "samplesCount": processed_count,
                "updatedAt": now
            }
        }
    )

    return {
        "success": True,
        "message": f'Face registered successfully for {student.get("name")} ({st_id}) with {processed_count} sample(s).',
        "studentId": st_id,
        "samplesCount": processed_count,
        "model": face_service.model_status
    }

@router.delete("/{student_id}")
async def delete_student_face(student_id: str):
    students_coll = db_manager["students"]
    faces_coll = db_manager["face_embeddings"]

    student = await students_coll.find_one({
        "$or": [
            {"studentId": student_id},
            {"_id": student_id}
        ]
    })
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{student_id}" not found.'
        )

    st_id = student["studentId"]
    del_res = await faces_coll.delete_one({"studentId": st_id})
    await students_coll.update_one(
        {"studentId": st_id},
        {
            "$set": {
                "faceRegistered": False,
                "samplesCount": 0,
                "updatedAt": datetime.utcnow().isoformat()
            }
        }
    )

    return {
        "success": True,
        "message": f"Biometric face data for {student.get('name')} ({st_id}) removed successfully.",
        "deletedCount": del_res.deleted_count
    }

@router.get("/{student_id}/status")
async def get_face_registration_status(student_id: str):
    students_coll = db_manager["students"]
    faces_coll = db_manager["face_embeddings"]

    student = await students_coll.find_one({
        "$or": [
            {"studentId": student_id},
            {"_id": student_id}
        ]
    })
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Student "{student_id}" not found.'
        )

    st_id = student["studentId"]
    face_record = await faces_coll.find_one({"studentId": st_id})

    return {
        "studentId": st_id,
        "studentName": student.get("name"),
        "faceRegistered": student.get("faceRegistered", False),
        "samplesCount": face_record.get("samplesCount", 0) if face_record else 0,
        "model": face_record.get("model") if face_record else None,
        "updatedAt": face_record.get("updatedAt") if face_record else None
    }
