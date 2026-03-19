@echo off
setlocal

REM Make script portable: run from the folder this .cmd lives in
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

cd /d "%ROOT%"
title COA Redaction Tool (Single Window Mode)

echo ============================================
echo    Starting COA Redaction Tool ( Rasesh )
echo ============================================

REM --- Start API server in background ---
echo Starting API server on port 8000...
start "" /b cmd /c "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

REM --- Start frontend server in background ---
echo Starting frontend server on port 5500...
start "" /b python -m http.server 5500 --bind 127.0.0.1 --directory "%ROOT%\frontend"

REM --- Wait for servers to boot ---
echo Waiting for servers to start...
timeout /t 3 >nul

REM --- Open browser automatically ---
echo Opening browser...
start "" "http://127.0.0.1:5500/index.html"

echo ============================================
echo   COA Redaction Tool is running.
echo   Press CTRL + C to stop servers.
echo ============================================
