@echo off
cd /d "%~dp0"
echo Verifying PTU Companion Functional Prototype v0.6...
node scripts\verify_v06.mjs
pause
