@echo off
cd /d %~dp0
if not exist node_modules call npm install
echo.
echo Demo accounts are shown below and on the login page. Press Ctrl+C to stop.
node server.js
pause
