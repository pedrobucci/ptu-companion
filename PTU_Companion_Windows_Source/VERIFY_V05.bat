@echo off
setlocal
cd /d "%~dp0"
echo Verifying PTU Companion Functional Prototype v0.5...
node scripts\verify_v05.mjs
if errorlevel 1 (
  echo.
  echo Verification FAILED.
  pause
  exit /b 1
)
echo.
echo Verification completed successfully.
pause
