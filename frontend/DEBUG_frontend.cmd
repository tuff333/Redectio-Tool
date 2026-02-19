@echo off
title COA Redaction Tool — FULL DEBUG

echo ============================================
echo      COA Redaction Tool (Full Debug)
echo ============================================

REM --- Start backend ---
echo.
echo [DEBUG] Starting backend API server...
cd /d "%~dp0backend"
cmd /k "uvicorn api_server:app --reload --port 8000"

echo.
echo [DEBUG] Backend stopped. Starting frontend...

REM --- Start frontend ---
cd /d "%~dp0frontend"
cmd /k "python -m http.server 5500"

pause
