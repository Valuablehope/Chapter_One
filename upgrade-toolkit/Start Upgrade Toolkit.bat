@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node-and-run.ps1"
if errorlevel 1 (
  echo.
  echo Something went wrong - see the messages above.
)
echo.
echo (This window will stay open so you can read the messages above. Press any key to close it.)
pause >nul
