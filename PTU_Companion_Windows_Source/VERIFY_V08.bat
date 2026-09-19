@echo off
setlocal
cd /d "%~dp0"
echo Verifying PTU Companion Functional Prototype v0.8...
node --experimental-sqlite scripts\verify_v08.mjs
if errorlevel 1 (
  echo.
  echo Verification FAILED.
  pause
  exit /b 1
)
echo.
echo Verification completed successfully.
pause
