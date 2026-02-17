@echo off
cd /d C:\projects\redact-tool-K2
title COA Redaction Tool (Single Window Mode)

echo ============================================
echo    Starting COA Redaction Tool ( Rasesh )
echo ============================================

REM --- Start API server in background ---
echo Starting API server on port 8000...
start /b python -m backend.api_server

REM --- Start frontend server in background ---
echo Starting frontend server on port 5500...
pushd frontend
start /b python -m http.server 5500
popd

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
