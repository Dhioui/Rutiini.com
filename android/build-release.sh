#!/bin/bash
# Rutiini Android Release Bundle Builder
# This script builds a signed release bundle for Google Play Store

echo ""
echo "========================================"
echo "  Rutiini Android Release Builder"
echo "========================================"
echo ""

# Set JAVA_HOME if not set
if [ -z "$JAVA_HOME" ]; then
    echo "Setting JAVA_HOME..."
    if [ -d "/Applications/Android Studio.app/Contents/jbr" ]; then
        export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr"
        echo "JAVA_HOME set to: $JAVA_HOME"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export JAVA_HOME="$HOME/Library/Android/sdk"
        echo "JAVA_HOME set to: $JAVA_HOME"
    fi
fi

# The web assets are build output and are not in version control, so a fresh
# clone has none. Gradle would happily package the app without them and produce
# an installable APK whose webview has nothing to load -- a blank screen on the
# phone, and nothing in the build output to warn about it.
ASSETS="app/src/main/assets/public/index.html"
if [ ! -f "$ASSETS" ]; then
    echo ""
    echo "ERROR: the web app has not been built into this project yet."
    echo ""
    echo "  Run this first, from the project root, with the address of your server:"
    echo ""
    echo "      VITE_API_URL=https://your-server.fi npm run build:mobile"
    echo ""
    echo "  Building now would produce an app with a blank screen."
    echo ""
    exit 1
fi

echo ""
echo "Step 1: Cleaning old builds..."
./gradlew clean
if [ $? -ne 0 ]; then
    echo "ERROR: Clean failed"
    exit 1
fi

echo ""
echo "Step 2: Building release bundle..."
echo "This may take 5-10 minutes..."
./gradlew bundleRelease
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed!"
    echo "Try running: ./gradlew bundleRelease --info"
    exit 1
fi

echo ""
echo "========================================"
echo "  BUILD SUCCESSFUL!"
echo "========================================"
echo ""
echo "Your signed Android App Bundle is ready:"
echo "  app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "Next steps:"
echo "1. Upload app-release.aab to Google Play Console"
echo "2. Complete the store listing"
echo "3. Submit for review"
echo ""
