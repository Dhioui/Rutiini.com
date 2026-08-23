@echo off
echo ===============================================
echo   Rutiini Android Release Builder
echo ===============================================
echo.

REM Navigate to project directory using absolute path
cd /d "C:\Users\yaser\Downloads\Rutiini (2)\Rutiini"

REM Verify we're in the right place
if not exist "package.json" (
    echo ERROR: Could not find package.json!
    echo Expected at: C:\Users\yaser\Downloads\Rutiini (2)\Rutiini
    echo Please ensure this script is in the project root directory.
    pause
    exit /b 1
)

REM Check if node is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    pause
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Building web app...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Syncing to Android...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo Step 4: Ensuring keystore configuration...
if not exist "android\keystore.properties" (
    (
        echo storeFile=rutiini-release.jks
        echo storePassword=rutiini2024
        echo keyAlias=rutiini-key
        echo keyPassword=rutiini2024
    ) > "android\keystore.properties"
    echo Created keystore.properties
)

if not exist "android\app\rutiini-release.jks" (
    echo ERROR: Keystore file missing at android\app\rutiini-release.jks
    echo Cannot proceed without existing keystore!
    pause
    exit /b 1
)

echo Keystore verified!

echo.
echo Step 5: Building Android release bundle...
cd android

if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    )
)

if "%ANDROID_HOME%"=="" (
    if exist "C:\Users\yaser\AppData\Local\Android\sdk" (
        set "ANDROID_HOME=C:\Users\yaser\AppData\Local\Android\sdk"
    )
)

call gradlew.bat clean
call gradlew.bat bundleRelease
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Android build failed!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ===============================================
echo   BUILD SUCCESSFUL!
echo ===============================================
echo.
echo Your signed Android App Bundle is located at:
echo android\app\build\outputs\bundle\release\app-release.aab
echo.
pause
