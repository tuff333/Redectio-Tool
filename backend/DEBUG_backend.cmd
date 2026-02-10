@echo off
title COA Redaction Tool — DEBUG MODE

echo ============================================
echo      COA Redaction Tool (Debug Mode)
echo ============================================

REM --- Move to backend folder and start API server ---
echo.
echo [DEBUG] Starting API server on port 8000...
cd /d "%~dp0backend"
echo Running: uvicorn api_server:app --reload --port 8000
start "" /wait cmd /k "uvicorn api_server:app --reload --port 8000"
echo.
echo [DEBUG] API server exited or failed.
pause
exit
