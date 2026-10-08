@echo off
title FaceAttend AI Launcher
echo ========================================================
echo   Launching FaceAttend AI (FastAPI + PostgreSQL + React)
echo ========================================================
echo.

echo Starting FastAPI Backend on http://localhost:8000 ...
start "FaceAttend AI - Backend" cmd /k "cd /d %~dp0backend && set PYTHONPATH=. && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo Starting React Vite Frontend on http://localhost:5173 ...
start "FaceAttend AI - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo   Both services started! Opening browser...
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:8000/docs
echo ========================================================
start http://localhost:5173

exit
