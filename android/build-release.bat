@echo off
REM Rutiini Android Release Bundle Builder
REM This script builds a signed release bundle for Google Play Store

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Rutiini Android Release Builder
echo ========================================
echo.

REM Set JAVA_HOME
if "%JAVA_HOME%"=="" (
    echo Setting JAVA_HOME...
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
        echo JAVA_HOME set to: !JAVA_HOME!
    ) else (
        echo ERROR: Could not find Android Studio JBR
        echo Please install Android Studio first
        pause
        exit /b 1
    )
)

REM Set ANDROID_HOME. Looked up under the current user's own AppData rather than
REM one particular person's folder, which is where the installer puts it.
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
        echo ANDROID_HOME set to: !ANDROID_HOME!
    )
)

REM Check for keystore and generate if needed
echo.
echo Step 0: Preparing keystore...

REM Try multiple Java paths
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    ) else if exist "C:\Program Files\Android\Android Studio\jre" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
    ) else if exist "%PROGRAMFILES%\Java\jdk*" (
        for /d %%d in ("%PROGRAMFILES%\Java\jdk*") do set "JAVA_HOME=%%d"
    ) else if exist "%PROGRAMFILES(X86)%\Java\jdk*" (
        for /d %%d in ("%PROGRAMFILES(X86)%\Java\jdk*") do set "JAVA_HOME=%%d"
    ) else (
        echo ERROR: Could not find Java!
        pause
        exit /b 1
    )
)

REM Check for keystore - already included in download
if not exist "rutiini-release.jks" (
    echo ERROR: Keystore file not found!
    echo Make sure rutiini-release.jks is in the android folder.
    pause
    exit /b 1
) else (
    echo Keystore found: rutiini-release.jks
)

REM Check for keystore.properties - already included in download
if not exist "keystore.properties" (
    echo ERROR: keystore.properties not found!
    echo Make sure keystore.properties is in the android folder.
    pause
    exit /b 1
) else (
    echo keystore.properties found
)

REM The web assets are build output and are not in version control, so a fresh
REM download has none. Gradle would package the app without them and produce an
REM installable app whose webview has nothing to load -- a blank screen on the
REM phone, with nothing in the build output to warn about it.
if not exist "app\src\main\assets\public\index.html" (
    echo.
    echo ERROR: the web app has not been built into this project yet.
    echo.
    echo   Run this first, in the project folder, with your server address:
    echo.
    echo       set VITE_API_URL=https://your-server.fi
    echo       npm run build:mobile
    echo.
    echo   Building now would produce an app with a blank screen.
    echo.
    pause
    exit /b 1
)

echo.
echo Step 1: Cleaning old builds...
call gradlew.bat clean
if !ERRORLEVEL! neq 0 (
    echo ERROR: Clean failed
    pause
    exit /b 1
)

echo.
echo Step 2: Building release bundle...
echo This may take 5-10 minutes...
call gradlew.bat bundleRelease
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Build failed!
    echo Try running: gradlew.bat bundleRelease --info
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD SUCCESSFUL!
echo ========================================
echo.
echo Your signed Android App Bundle is ready:
echo   app\build\outputs\bundle\release\app-release.aab
echo.
echo Next steps:
echo 1. Upload app-release.aab to Google Play Console
echo 2. Complete the store listing
echo 3. Submit for review
echo.
pause
