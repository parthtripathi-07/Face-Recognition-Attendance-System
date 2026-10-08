from contextlib import asynccontextmanager
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import db_manager
from app.routes.auth import ensure_default_admin, router as auth_router
from app.routes.students import router as students_router
from app.routes.faces import router as faces_router
from app.routes.recognition import router as recognition_router
from app.routes.attendance import router as attendance_router
from app.routes.reports import router as reports_router
from app.routes.settings_route import router as settings_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("faceattend.main")

START_TIME = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing FaceAttend AI Backend Services...")
    await db_manager.connect()
    try:
        await ensure_default_admin()
    except Exception as ex:
        logger.warning(f"Default admin init notice: {ex}")
    yield
    logger.info("Shutting down FaceAttend AI Backend...")
    await db_manager.close()

app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Face Recognition Attendance System API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    process_time = time.time() - start
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response

# Include all API routes
app.include_router(auth_router)
app.include_router(students_router)
app.include_router(faces_router)
app.include_router(recognition_router)
app.include_router(attendance_router)
app.include_router(reports_router)
app.include_router(settings_router)

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "Smart Face Recognition Attendance System",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/api/health")
async def health_check():
    uptime_seconds = int(time.time() - START_TIME)
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database_mode": db_manager.mode,
        "uptime_seconds": uptime_seconds,
        "recognition_threshold": settings.RECOGNITION_THRESHOLD,
        "environment": settings.APP_ENV
    }
