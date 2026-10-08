import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import db_manager
from app.services.face_recognition import face_service

logger = logging.getLogger("faceattend.recognition")
router = APIRouter(prefix="/api/recognition", tags=["Face Recognition"])

class RecognizePayload(BaseModel):
    image: str = Field(..., description="Base64 encoded frame from webcam")
    threshold: Optional[float] = Field(None, ge=0.1, le=1.0, description="Override recognition cosine threshold")
    sessionId: Optional[str] = Field(None, description="Optional active attendance session ID")

@router.post("/recognize")
async def recognize_face(payload: RecognizePayload):
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
    results = face_service.recognize_frame(img, registered_faces, threshold=threshold)

    faces_detected = len(results)
    if faces_detected == 0:
        return {
            "recognized": False,
            "facesDetected": 0,
            "message": "No face detected in camera frame.",
            "results": [],
            "model": face_service.model_status
        }

    # If at least one face is recognized
    any_recognized = any(r.get("recognized") for r in results)
    primary_result = results[0]

    response_data = {
        "facesDetected": faces_detected,
        "recognized": any_recognized,
        "results": results,
        "model": face_service.model_status
    }

    if primary_result.get("recognized"):
        response_data["student"] = primary_result.get("student")
        response_data["confidence"] = primary_result.get("confidence")
        response_data["confidencePercent"] = primary_result.get("confidencePercent")
    else:
        response_data["message"] = primary_result.get("message", "Unknown face")

    return response_data
