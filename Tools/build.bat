@echo off
cd /d "%~dp0\.."
echo ==============================================
echo   Horosho V Lesu - Building Production Bundle
echo ==============================================
npm.cmd run build
pause
