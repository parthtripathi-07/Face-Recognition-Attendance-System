from datetime import datetime
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import db_manager
from app.utils.security import create_access_token, decode_access_token, hash_password, verify_password

logger = logging.getLogger("faceattend.routes.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginPayload(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)

class ChangePasswordPayload(BaseModel):
    currentPassword: str
    newPassword: str = Field(..., min_length=6)

async def ensure_default_admin():
    admins_coll = db_manager["admins"]
    admin = await admins_coll.find_one({"username": settings.DEFAULT_ADMIN_USERNAME})
    if not admin:
        logger.info(f"Seeding default demo admin '{settings.DEFAULT_ADMIN_USERNAME}'...")
        default_admin = {
            "_id": uuid.uuid4().hex,
            "username": settings.DEFAULT_ADMIN_USERNAME,
            "passwordHash": hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            "email": settings.DEFAULT_ADMIN_EMAIL,
            "role": "admin",
            "isDefaultDemo": True,
            "createdAt": datetime.utcnow().isoformat()
        }
        await admins_coll.insert_one(default_admin)

async def get_current_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token. Please log in."
        )
    token = authorization.split("Bearer ", 1)[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid. Please log in again."
        )

    admins_coll = db_manager["admins"]
    admin = await admins_coll.find_one({"username": payload["sub"]})
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin user not found."
        )
    return admin

@router.post("/login")
async def login(payload: LoginPayload):
    await ensure_default_admin()
    admins_coll = db_manager["admins"]
    admin = await admins_coll.find_one({"username": payload.username.strip()})

    if not admin or not verify_password(payload.password, admin.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password. For development demo, use admin / admin123."
        )

    token = create_access_token({"sub": admin["username"], "role": admin.get("role", "admin")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": admin["username"],
            "email": admin.get("email"),
            "role": admin.get("role", "admin"),
            "isDefaultDemo": admin.get("isDefaultDemo", False)
        }
    }

@router.get("/me")
async def get_me(admin: dict = Depends(get_current_admin)):
    return {
        "username": admin["username"],
        "email": admin.get("email"),
        "role": admin.get("role", "admin"),
        "isDefaultDemo": admin.get("isDefaultDemo", False),
        "createdAt": admin.get("createdAt")
    }

@router.post("/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully."}

@router.post("/change-password")
async def change_password(payload: ChangePasswordPayload, admin: dict = Depends(get_current_admin)):
    admins_coll = db_manager["admins"]
    if not verify_password(payload.currentPassword, admin.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    new_hash = hash_password(payload.newPassword)
    await admins_coll.update_one(
        {"_id": admin["_id"]},
        {"$set": {"passwordHash": new_hash, "isDefaultDemo": False, "updatedAt": datetime.utcnow().isoformat()}}
    )
    return {"success": True, "message": "Password changed successfully. Demo flag cleared."}
