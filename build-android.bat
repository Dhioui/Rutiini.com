@echo off
REM ============================================================================
REM  Rutiini Android Release Builder (Windows)
REM
REM  Usage, from anywhere:
REM
REM      build-android.bat https://oma-palvelimesi.fi
REM
REM  or set the address first and run it without arguments:
REM
REM      set VITE_API_URL=https://oma-palvelimesi.fi
REM      build-android.bat
REM ============================================================================
setlocal enabledelayedexpansion

REM Work from the folder this script lives in. It used to cd to one particular
REM absolute path under one person's Downloads folder, so it could not work on
REM any other machine, or even on the same machine once the project moved.
cd /d "%~dp0"

echo.
echo ===============================================
echo   Rutiini Android Release Builder
echo ===============================================
echo.

if not exist "package.json" (
    echo ERROR: package.json not found in "%CD%".
    echo Keep this script in the project root folder.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed, or is not on PATH.
    echo Install it from https://nodejs.org and open a new terminal.
    pause
    exit /b 1
)

REM The server address, taken from the first argument if one was given.
if not "%~1"=="" set "VITE_API_URL=%~1"

REM A native build has no server to fall back on: the address is compiled into
REM the bundle. Without it npm run build:mobile refuses, so ask here where the
REM message can name the Windows syntax -- the bash form in the guides does not
REM work in cmd.
if "%VITE_API_URL%"=="" (
    echo ERROR: the server address is missing.
    echo.
    echo   The app is told at build time where its server is, so run either:
    echo.
    echo       build-android.bat https://oma-palvelimesi.fi
    echo.
    echo   or:
    echo.
    echo       set VITE_API_URL=https://oma-palvelimesi.fi
    echo       build-android.bat
    echo.
    echo   In PowerShell the second form is:
    echo.
    echo       $env:VITE_API_URL = "https://oma-palvelimesi.fi"
    echo.
    pause
    exit /b 1
)

echo Server address: %VITE_API_URL%
echo.

echo Step 1 of 4: installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo Step 2 of 4: building the web app and syncing it into android\...
REM This also runs "npx cap sync", so there is no separate sync step.
call npm run build:mobile
if errorlevel 1 (
    echo ERROR: the web build failed.
    pause
    exit /b 1
)

echo.
echo Step 3 of 4: checking the signing key...

REM Not created here. These are the credentials that sign the app for Google
REM Play; writing a default password into a file would mean every copy of this
REM project shares one, and the file is deliberately kept out of version
REM control. Generate your own once, and keep it somewhere safe.
if not exist "android\keystore.properties" (
    echo ERROR: android\keystore.properties not found.
    echo.
    echo   Create the signing key once:
    echo.
    echo       cd android
    echo       node generate-keystore.cjs
    echo.
    echo   Keep the generated .jks file and its passwords safe: losing them
    echo   means you can never update the app on Google Play again.
    echo.
    pause
    exit /b 1
)

if not exist "android\app\rutiini-release.jks" (
    if not exist "android\rutiini-release.jks" (
        echo ERROR: the keystore file rutiini-release.jks was not found.
        echo Expected in android\app\ or android\.
        pause
        exit /b 1
    )
)
echo Signing key found.

echo.
echo Step 4 of 4: building the release bundle. This takes several minutes...
cd android

REM Android Studio ships its own Java. Only guess when nothing is configured,
REM and look where the installer actually puts things rather than at one
REM particular user's folder.
if "%JAVA_HOME%"=="" (
    if exist "%ProgramFiles%\Android\Android Studio\jbr" (
        set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    ) else if exist "%ProgramFiles%\Android\Android Studio\jre" (
        set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jre"
    )
)

if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

if "%JAVA_HOME%"=="" (
    echo ERROR: Java was not found. Install Android Studio, or set JAVA_HOME
    echo to a JDK 21 installation.
    cd ..
    pause
    exit /b 1
)

call gradlew.bat clean
if errorlevel 1 (
    echo ERROR: clean failed.
    cd ..
    pause
    exit /b 1
)

call gradlew.bat bundleRelease
if errorlevel 1 (
    echo.
    echo ERROR: the Android build failed.
    echo For more detail run:  gradlew.bat bundleRelease --info
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ===============================================
echo   BUILD SUCCESSFUL
echo ===============================================
echo.
echo Signed bundle for Google Play:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo.
echo It talks to: %VITE_API_URL%
echo.
echo Remember to raise versionCode in android\app\build.gradle before each
echo upload, or Google Play will refuse the file.
echo.
pause
