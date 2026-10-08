import base64
import cv2
from fastapi.testclient import TestClient
import numpy as np
from app.main import app

def run_tests():
    with TestClient(app) as client:
        print("=== 1. Health & Root Endpoint ===")
        r_health = client.get("/api/health")
        assert r_health.status_code == 200
        print("Health status:", r_health.json()["status"], "DB Mode:", r_health.json()["database_mode"])

        print("\n=== 2. Auth Login (Admin / Demo) ===")
        r_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert r_login.status_code == 200
        token = r_login.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}
        print("Login OK. Token received.")

        r_me = client.get("/api/auth/me", headers=auth_headers)
        assert r_me.status_code == 200
        assert r_me.json()["username"] == "admin"
        print("Auth /me OK. User:", r_me.json()["username"])

        print("\n=== 3. Student Registration & Validation ===")
        r_st = client.post("/api/students", json={
            "name": "Aman Verma",
            "rollNumber": "CSE201",
            "email": "aman@example.com",
            "phone": "9811223344",
            "branch": "CSE",
            "year": "3rd Year",
            "section": "B"
        })
        print("Create Student status:", r_st.status_code)
        assert r_st.status_code in (201, 400)
        
        # Test Duplicate Roll Number Prevention
        r_dup = client.post("/api/students", json={
            "name": "Aman Kumar",
            "rollNumber": "CSE201",
            "branch": "CSE",
            "year": "3rd Year"
        })
        assert r_dup.status_code == 400
        print("Duplicate roll number prevented: OK")

        print("\n=== 4. Attendance Session Management ===")
        r_sess = client.post("/api/attendance/sessions", json={
            "subject": "Artificial Intelligence",
            "branch": "CSE",
            "year": "3rd Year",
            "section": "B"
        })
        assert r_sess.status_code == 200
        session_id = r_sess.json()["sessionId"]
        print("Created active session:", session_id)

        print("\n=== 5. Attendance Marking & Duplicate Prevention ===")
        r_mark = client.post("/api/attendance/mark", json={
            "studentId": "CSE201",
            "confidence": 0.95,
            "sessionId": session_id
        })
        assert r_mark.status_code == 200
        print("Attendance mark 1 status:", r_mark.json().get("status"))

        # Immediate repeat should trigger cooldown or already_marked
        r_mark_dup = client.post("/api/attendance/mark", json={
            "studentId": "CSE201",
            "confidence": 0.95,
            "sessionId": session_id
        })
        assert r_mark_dup.status_code == 200
        assert r_mark_dup.json().get("status") in ("cooldown", "already_marked")
        print("Duplicate attendance prevented successfully:", r_mark_dup.json().get("status"))

        print("\n=== 6. Attendance History & Today Summary ===")
        r_hist = client.get("/api/attendance?branch=CSE")
        assert r_hist.status_code == 200
        print("Total attendance records found:", r_hist.json()["total"])

        r_today = client.get("/api/attendance/today")
        assert r_today.status_code == 200
        print("Today present:", r_today.json()["presentToday"], "Total students:", r_today.json()["totalStudents"])

        print("\n=== 7. Reports & Analytics ===")
        r_dash = client.get("/api/reports/dashboard")
        assert r_dash.status_code == 200
        assert "trend" in r_dash.json()
        print("Dashboard stats loaded. 7-day trend items:", len(r_dash.json()["trend"]))

        r_daily = client.get("/api/reports/daily")
        assert r_daily.status_code == 200
        print("Daily report loaded:", r_daily.json()["date"], "Attendance %:", r_daily.json()["percentage"])

        r_monthly = client.get("/api/reports/monthly")
        assert r_monthly.status_code == 200
        print("Monthly report loaded:", r_monthly.json()["month"], "Students summary count:", len(r_monthly.json()["summary"]))

        print("\n=== 8. CSV & Excel Export ===")
        r_csv = client.get("/api/reports/export/csv")
        assert r_csv.status_code == 200
        assert "Date,Time,Student ID" in r_csv.text
        print("CSV export verified. Output rows generated.")

        r_excel = client.get("/api/reports/export/excel")
        assert r_excel.status_code == 200
        assert len(r_excel.content) > 500
        print("Excel spreadsheet export verified. File size:", len(r_excel.content), "bytes.")

        print("\n=== 9. System & Recognition Settings ===")
        r_set = client.get("/api/settings")
        assert r_set.status_code == 200
        print("Current Recognition Threshold:", r_set.json()["recognitionThreshold"])

        r_set_up = client.put("/api/settings", json={"recognitionThreshold": 0.40})
        assert r_set_up.status_code == 200
        assert r_set_up.json()["recognitionThreshold"] == 0.40
        print("Updated Recognition Threshold to 0.40 successfully.")

        print("\n[OK] ALL BACKEND INTEGRATION TESTS PASSED 100%! [OK]")

if __name__ == "__main__":
    run_tests()
