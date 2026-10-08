# FaceAttend AI — Smart Face Recognition Attendance System

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![OpenCV](https://img.shields.io/badge/AI%20Model-OpenCV%20SFace%20(ArcFace)-5C3EE8.svg?style=flat&logo=opencv)](https://opencv.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20%2B%20Atlas-47A248.svg?style=flat&logo=mongodb)](https://mongodb.com)

---

## 1. Project Overview

**FaceAttend AI** is a complete, modern, production-grade Face Recognition Attendance System designed for colleges, universities, schools, coaching institutes, and organizations. The system leverages state-of-the-art deep facial recognition (OpenCV YuNet face detection & SFace ArcFace/CosFace 128-dimensional embedding vectors) to automate student identification and attendance logging via live webcam feeds.

Rather than a basic college project demo, **FaceAttend AI** is engineered as a responsive, modern SaaS dashboard with duplicate attendance prevention, class session management, real-time analytics, daily/monthly reports, and Excel/CSV data exports.

---

## 2. Key Features

- **High-Precision Face Recognition**:
  - **YuNet Face Detector**: Ultra-fast CNN-based face detection with landmark alignment (eyes, nose, mouth corners).
  - **SFace / ArcFace Feature Extractor**: 128-dimensional L2-normalized deep face embeddings compared via cosine similarity.
  - **Multi-sample Enrollment**: Captures 5 distinct facial angle samples during registration to create a robust mathematical centroid profile.
  - **Configurable Thresholds**: Adjustable cosine recognition threshold and minimum face quality filters via admin settings.

- **Anti-Duplicate Attendance & Cooldown**:
  - Server-side authoritative timestamps (UTC / local timezone aware).
  - Configurable cooldown window (default: 10s) to prevent repeated hammering of identical frames.
  - Duplicate check prevents a student from being marked multiple times during the same class session or day.

- **Class Session Concept**:
  - Start scheduled lecture sessions (e.g., *Subject: Data Structures*, *Branch: CSE*, *Year: 3rd Year*, *Section: A*).
  - Live attendance is tied to the active lecture session.

- **Admin Dashboard & Analytics**:
  - KPI Cards: Total Students, Present Today, Absent Today, Attendance Percentage.
  - Recharts Visualizations: 7-day attendance trend area chart, Donut turnout ratio, Weekly attendance bar chart.
  - Real-time attendance log feed with sound alerts (synthesized Web Audio chimes).

- **Student Directory Management**:
  - Add, edit, search, filter (by branch, year, face registration status).
  - One-click launch to camera biometric enrollment.
  - Privacy-compliant biometric deletion.

- **Reporting & Data Export**:
  - **Daily Roll Call**: Full student roster with verification timestamps and confidence scores.
  - **Monthly Aggregate**: Total sessions, present counts, absent counts, and attendance percentage progress bars.
  - Instant **CSV Export** and styled **Excel (`.xlsx`) Export**.

- **Security & Privacy**:
  - JWT Bearer Authentication with Bcrypt password hashing.
  - Biometric vectors stored strictly as numerical floating-point arrays; raw images are discarded from memory.
  - Resilient hybrid storage: Operates seamlessly on **MongoDB Atlas** or local MongoDB, with an automatic embedded async JSON engine fallback if offline.
  - Dark Mode & Light Mode support.

---

## 3. Technology Stack

### Frontend
- **Framework**: React.js 18+ (Vite)
- **Styling**: Tailwind CSS v4
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios with automatic JWT injection & error handling
- **Icons**: Lucide React
- **Data Visualizations**: Recharts

### Backend
- **Language**: Python 3.10 – 3.14
- **Web Framework**: FastAPI (Asynchronous ASGI)
- **Server**: Uvicorn
- **Computer Vision**: OpenCV (`cv2.FaceDetectorYN`, `cv2.FaceRecognizerSF`)
- **Scientific Computing**: NumPy
- **Data Validation & Settings**: Pydantic v2 & Pydantic-Settings
- **Database Driver**: Motor / PyMongo (with Resilient MongoDB fallback)
- **Security**: PyJWT, Bcrypt

---

## 4. Architecture & System Flow

```text
Admin Login
     ↓
Dashboard
     ↓
Add Student ────→ Enter Details (Roll No, Branch, Year)
     ↓
Register Face ──→ Live Camera (5 Samples, Multi-Angle)
     ↓
OpenCV YuNet ───→ Landmark Alignment & Quality Verification
     ↓
SFace ArcFace ──→ 128-dim Normalized Centroid Vector
     ↓
Database ───────→ Store Embedding in `face_embeddings`
     ↓
Start Session ──→ Choose Subject, Branch, Year, Section
     ↓
Live Attendance → Camera Stream (2-3 FPS)
     ↓
Face Detection ─→ Multi-Face Independent Matching
     ↓
Cos Similarity ─→ Threshold Check (≥ 0.38)
     ↓
Recognized? ────→ [NO] → Flag Unknown / Low Confidence
     ↓ [YES]
Duplicate Check ─→ Already Marked Today?
     ↓ [NO]
Mark Attendance ─→ Server Timestamp, Database Insert, Audio Chime & Live Feed
```

---

## 5. Project Folder Structure

```text
faceattend-ai/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── CameraView.jsx           # Reusable HTML5 webcam & face overlay component
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # JWT authentication session manager
│   │   │   └── ThemeContext.jsx         # Dark / Light mode provider
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx      # Navigation sidebar, topbar & responsive drawer
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx            # Modern login page with demo auto-fill
│   │   │   ├── DashboardPage.jsx        # Analytics charts & live summary
│   │   │   ├── StudentsPage.jsx         # Directory, search, filter, add/edit modal
│   │   │   ├── FaceRegistrationPage.jsx # 5-sample camera enrollment UI
│   │   │   ├── LiveAttendancePage.jsx   # Continuous camera recognition & live feed
│   │   │   ├── AttendanceHistoryPage.jsx# Chronological history table & filters
│   │   │   ├── ReportsPage.jsx          # Daily & monthly reports + CSV/Excel export
│   │   │   ├── SettingsPage.jsx         # Model tuning, institute profile, password
│   │   │   └── NewSessionPage.jsx       # Class lecture session creator
│   │   ├── services/
│   │   │   └── api.js                   # Axios client with interceptors
│   │   ├── App.jsx                      # Route definitions & ProtectedRoute guard
│   │   ├── index.css                    # Tailwind CSS v4 styling
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   │   ├── config.py                    # Pydantic Settings
│   │   ├── database.py                  # Dual-mode Motor / MongoDB manager
│   │   ├── main.py                      # FastAPI app & route mounting
│   │   ├── routes/
│   │   │   ├── auth.py                  # Login, /me, change password
│   │   │   ├── students.py              # CRUD, search, duplicate checks
│   │   │   ├── faces.py                 # Biometric sample registration
│   │   │   ├── recognition.py           # Frame recognition
│   │   │   ├── attendance.py            # Attendance check-in & sessions
│   │   │   ├── reports.py               # Daily/Monthly reports & CSV/Excel streaming
│   │   │   └── settings_route.py        # Hyperparameter configuration
│   │   ├── services/
│   │   │   ├── face_recognition.py      # YuNet & SFace ArcFace engine
│   │   │   ├── attendance_service.py    # Cooldown & duplicate prevention logic
│   │   │   └── report_service.py        # Analytics aggregation & openpyxl generation
│   │   ├── schemas/
│   │   │   └── student.py               # Pydantic models
│   │   └── utils/
│   │       └── security.py              # JWT & Bcrypt helpers
│   ├── data/
│   │   ├── models/                      # YuNet & SFace ONNX model weights
│   │   └── storage/                     # Resilient fallback local store
│   ├── tests/
│   │   └── test_api.py                  # Pytest test suite (13 automated tests)
│   ├── requirements.txt
│   └── .env.example
│
├── README.md
└── .gitignore
```

---

## 6. Installation & Quick Start

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ (Tested on Node.js v24)
- Web browser with webcam access permissions (Chrome, Edge, Firefox, Safari)

### 1. Setup Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env
```

Start the FastAPI backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### 2. Setup Frontend

Open a second terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Open your browser and navigate to:
```text
http://localhost:5173
```

---

## 7. Default Credentials (Development Mode)

- **Username**: `admin`
- **Password**: `admin123`

*(You can click the **"Use Demo Login"** button on the `/login` screen to auto-fill these credentials. To change credentials in production, go to the **Settings** page).*

---

## 8. Database Configuration

### Option A: MongoDB Atlas (Production)
In `backend/.env`, set:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=faceattend_ai
```

### Option B: Local MongoDB
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=faceattend_ai
```

### Option C: Resilient Zero-Setup Mode (Default)
If no MongoDB daemon is running locally and no Atlas URI is provided, the backend will automatically activate the built-in **Resilient Storage Engine** (`backend/data/storage/*.json`). The application runs immediately without crashing or requiring any manual database server setup.

---

## 9. Running Tests

To run the complete automated integration test suite:

```bash
cd backend
pytest -v
```

This verifies:
1. Health and lifespan connectivity
2. Admin authentication and JWT token generation
3. Student registration and duplicate roll number prevention
4. Attendance session creation
5. Attendance marking and duplicate check-in prevention
6. Dashboard statistics and 7-day trend calculation
7. Daily roll call reports
8. Monthly student attendance summaries
9. CSV report streaming
10. Excel (`.xlsx`) binary generation
11. Recognition threshold runtime tuning

---

## 10. Privacy & Biometric Ethics

- **No Raw Image Retention**: Images sent via camera frames are analyzed in memory and immediately discarded; only 128-dimensional mathematical feature vectors are saved.
- **Biometric Purge**: Administrators have full authority to delete student profiles and their associated facial vectors at any time via the Student Management page.
- **Admin-Only Access**: All attendance records and biometric controls are protected behind JWT authentication.

---

## 11. License

MIT License. Designed and built with modern engineering practices for FaceAttend AI.
