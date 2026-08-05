@echo off
cd /d "%~dp0"
echo Starting Geography Hub...
echo Keep this window open while playing.
start "" http://localhost:8000
python -m http.server 8000
if errorlevel 1 (
  echo.
  echo Python was not found. Install Python, or open this folder in VS Code and use Live Server.
  pause
)
