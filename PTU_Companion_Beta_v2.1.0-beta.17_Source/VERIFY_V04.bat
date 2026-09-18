@echo off
setlocal
cd /d "%~dp0"
node scripts\verify_v04.mjs
if errorlevel 1 (
  echo.
  echo Verification failed.
  pause
  exit /b 1
)
echo.
echo Verification completed successfully.
pause
