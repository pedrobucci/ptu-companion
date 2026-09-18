@echo off
cd /d %~dp0
node --no-warnings scripts\inspect_definitions.mjs
pause
