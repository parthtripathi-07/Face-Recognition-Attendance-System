import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.database import db_manager

logger = logging.getLogger("faceattend.routes.settings")
router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SettingsUpdatePayload(BaseModel):
    recognitionThreshold: Optional[float] = Field(None, ge=0.1, le=0.9, description="Cosine recognition threshold")
    minFaceQuality: Optional[float] = Field(None, ge=0.1, le=1.0)
    instituteName: Optional[str] = Field(None, min_length=2, max_length=100)
    academicSession: Optional[str] = Field(None, min_length=2, max_length=50)
    timezone: Optional[str] = None
    cooldownSeconds: Optional[int] = Field(None, ge=1, le=60)
    allowDuplicateSameDay: Optional[bool] = None
    requireEyeBlink: Optional[bool] = Field(None, description="Require live eye blink to mark attendance")
    livenessEnabled: Optional[bool] = Field(None, description="Enable anti-spoofing and liveness detection")

DEFAULT_SETTINGS = {
    "_id": "app_settings",
    "recognitionThreshold": settings.RECOGNITION_THRESHOLD,
    "minFaceQuality": settings.MIN_FACE_QUALITY,
    "instituteName": "FaceAttend AI Institute of Technology",
    "academicSession": "2026-2027",
    "timezone": settings.TIMEZONE,
    "cooldownSeconds": settings.COOLDOWN_SECONDS,
    "allowDuplicateSameDay": settings.ALLOW_DUPLICATE_SAME_DAY,
    "requireEyeBlink": settings.REQUIRE_EYE_BLINK,
    "livenessEnabled": settings.LIVENESS_ENABLED
}

@router.get("")
async def get_settings():
    coll = db_manager["settings"]
    current = await coll.find_one({"_id": "app_settings"})
    if not current:
        await coll.insert_one(dict(DEFAULT_SETTINGS))
        return DEFAULT_SETTINGS
    merged = dict(DEFAULT_SETTINGS)
    merged.update(current)
    return merged

@router.put("")
async def update_settings(payload: SettingsUpdatePayload):
    coll = db_manager["settings"]
    update_data = {}
    if payload.recognitionThreshold is not None:
        update_data["recognitionThreshold"] = payload.recognitionThreshold
        settings.RECOGNITION_THRESHOLD = payload.recognitionThreshold
    if payload.minFaceQuality is not None:
        update_data["minFaceQuality"] = payload.minFaceQuality
        settings.MIN_FACE_QUALITY = payload.minFaceQuality
    if payload.instituteName is not None:
        update_data["instituteName"] = payload.instituteName.strip()
    if payload.academicSession is not None:
        update_data["academicSession"] = payload.academicSession.strip()
    if payload.timezone is not None:
        update_data["timezone"] = payload.timezone.strip()
        settings.TIMEZONE = payload.timezone.strip()
    if payload.cooldownSeconds is not None:
        update_data["cooldownSeconds"] = payload.cooldownSeconds
        settings.COOLDOWN_SECONDS = payload.cooldownSeconds
    if payload.allowDuplicateSameDay is not None:
        update_data["allowDuplicateSameDay"] = payload.allowDuplicateSameDay
        settings.ALLOW_DUPLICATE_SAME_DAY = payload.allowDuplicateSameDay
    if payload.requireEyeBlink is not None:
        update_data["requireEyeBlink"] = payload.requireEyeBlink
        settings.REQUIRE_EYE_BLINK = payload.requireEyeBlink
    if payload.livenessEnabled is not None:
        update_data["livenessEnabled"] = payload.livenessEnabled
        settings.LIVENESS_ENABLED = payload.livenessEnabled

    if update_data:
        await coll.update_one({"_id": "app_settings"}, {"$set": update_data}, upsert=True)

    return await coll.find_one({"_id": "app_settings"})
