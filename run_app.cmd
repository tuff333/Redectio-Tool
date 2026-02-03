@echo off
title COA Redaction Tool

echo Starting COA Redaction API server...
start "" cmd /c "uvicorn backend.api_server:app --reload --port 8000"

echo Starting frontend server...
cd frontend
start "" cmd /c "python -m http.server 5500"
cd ..

echo Waiting for servers to start...
timeout /t 3 >nul

echo Opening browser...
start "" "http://127.0.0.1:5500/index.html"

echo App is running.
