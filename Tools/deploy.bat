@echo off
cd /d "%~dp0\.."
echo ==============================================
echo   Horosho V Lesu - Deploy to GitHub Pages
echo ==============================================

echo 1. Testing build...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed! Check errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2. Committing changes...
git add -A
git commit -m "Auto-deploy update %date% %time%"

echo.
echo 3. Pushing to GitHub...
git push origin main

echo.
echo ==============================================
echo   DEPLOY TRIGGERED SUCCESSFULLY!
echo   GitHub Pages is updating your app.
echo   Spouses' phones will auto-update on next launch!
echo ==============================================
pause
