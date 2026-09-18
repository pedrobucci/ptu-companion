@echo off
cd /d %~dp0
echo Verifying PTU Companion Functional Prototype v0.7...
node --no-warnings scripts\verify_v07.mjs
pause
