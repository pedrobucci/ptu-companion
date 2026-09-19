@echo off
cd /d %~dp0
start "PTU Companion Server" cmd /k node --no-warnings server.mjs
timeout /t 2 /nobreak > nul
start http://127.0.0.1:4173
