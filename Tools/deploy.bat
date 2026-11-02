@echo off
cd /d "%~dp0\.."
echo ==============================================
echo   Horosho V Lesu - Deploy to GitHub Pages
echo ==============================================

echo 1. Syncing and bumping build version...
call node Tools/sync-version.cjs --bump-build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to bump version!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2. Building production web bundle...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed! Check errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 3. Syncing Capacitor assets to Android...
call npx.cmd cap copy android

echo.
echo 4. Committing changes...
git add -A
git commit -m "Auto-deploy update %date% %time%"

echo.
echo 5. Pushing to GitHub...
git push origin main

echo.
echo ==============================================
echo   DEPLOY TRIGGERED SUCCESSFULLY!
echo   GitHub Pages is updating your app.
echo   Spouses' phones will auto-update on next launch!
echo ==============================================
pause
