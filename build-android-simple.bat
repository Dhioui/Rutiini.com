@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo     RUTIINI - Android Build (Click-Only)
echo ============================================
echo.

REM First, check if we're in the right folder
if not exist "package.json" (
    echo ERROR: This script must be in the project folder!
    echo Please copy this file to: C:\Rutiini\
    echo Then double-click it.
    pause
    exit /b 1
)

echo STEP 1 of 4: Installing packages...
call npm install
if !ERRORLEVEL! neq 0 (
    echo ERROR at step 1!
    pause
    exit /b 1
)

echo STEP 2 of 4: Building website...
call npm run build:mobile
if !ERRORLEVEL! neq 0 (
    echo ERROR at step 2!
    pause
    exit /b 1
)

echo STEP 3 of 4: Syncing to Android...
REM build:mobile already ran "npx cap sync".
if !ERRORLEVEL! neq 0 (
    echo ERROR at step 3!
    pause
    exit /b 1
)

echo STEP 4 of 4: Building Android app...
cd android
call gradlew.bat bundleRelease
if !ERRORLEVEL! neq 0 (
    echo ERROR at step 4!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ============================================
echo     SUCCESS! App is ready.
echo ============================================
echo.
echo File location:
echo android\app\build\outputs\bundle\release\app-release.aab
echo.
pause
