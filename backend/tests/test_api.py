import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["app"] == "FaceAttend AI"

def test_admin_login_success(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"

def test_admin_login_failure(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401

def test_auth_me_with_token(client):
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["username"] == "admin"

def test_create_student_and_duplicate(client):
    # Unique roll number for this test
    roll = f"TEST_ROLL_99"
    res1 = client.post("/api/students", json={
        "name": "Test Student",
        "rollNumber": roll,
        "branch": "CSE",
        "year": "3rd Year",
        "section": "A"
    })
    assert res1.status_code in (201, 400)

    # Attempt duplicate
    res_dup = client.post("/api/students", json={
        "name": "Another Student",
        "rollNumber": roll,
        "branch": "IT",
        "year": "2nd Year"
    })
    assert res_dup.status_code == 400

def test_attendance_session(client):
    res = client.post("/api/attendance/sessions", json={
        "subject": "Cloud Computing",
        "branch": "CSE",
        "year": "4th Year",
        "section": "A"
    })
    assert res.status_code == 200
    data = res.json()
    assert "sessionId" in data
    assert data["status"] == "active"

def test_attendance_mark_and_duplicate(client):
    res = client.post("/api/attendance/mark", json={
        "studentId": "TEST_ROLL_99",
        "confidence": 0.96
    })
    assert res.status_code == 200

    # Immediate second mark
    res2 = client.post("/api/attendance/mark", json={
        "studentId": "TEST_ROLL_99",
        "confidence": 0.96
    })
    assert res2.status_code == 200
    assert res2.json().get("status") in ("cooldown", "already_marked")

def test_dashboard_report(client):
    res = client.get("/api/reports/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "totalStudents" in data
    assert "presentToday" in data
    assert "trend" in data

def test_daily_report(client):
    res = client.get("/api/reports/daily")
    assert res.status_code == 200
    data = res.json()
    assert "totalStudents" in data
    assert "students" in data

def test_monthly_report(client):
    res = client.get("/api/reports/monthly")
    assert res.status_code == 200
    data = res.json()
    assert "month" in data
    assert "summary" in data

def test_csv_export(client):
    res = client.get("/api/reports/export/csv")
    assert res.status_code == 200
    assert "Date,Time,Student ID" in res.text

def test_excel_export(client):
    res = client.get("/api/reports/export/excel")
    assert res.status_code == 200
    assert len(res.content) > 500

def test_settings_endpoints(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    current_thresh = res.json()["recognitionThreshold"]

    res_put = client.put("/api/settings", json={"recognitionThreshold": 0.42})
    assert res_put.status_code == 200
    assert res_put.json()["recognitionThreshold"] == 0.42

    # Reset
    client.put("/api/settings", json={"recognitionThreshold": current_thresh})

def test_monthly_register_excel_export(client):
    res = client.get("/api/reports/export/monthly-register?month=2026-10&mode=active")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats" in res.headers.get("content-type", "")
    assert len(res.content) > 1000

def test_monthly_register_csv_export(client):
    res = client.get("/api/reports/export/monthly-register/csv?month=2026-10&mode=active")
    assert res.status_code == 200
    assert "S NO,ROLL NO,NAME" in res.text
