@echo off
cd /d %~dp0
node --no-warnings scripts\verify_v03.mjs
pause
