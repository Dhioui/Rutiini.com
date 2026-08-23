#!/bin/bash

echo "==============================================="
echo "  Rutiini Android Build Script"
echo "==============================================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed!"
    exit 1
fi

echo ""
echo "Step 2: Building web app..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "Step 3: Syncing to Android..."
npx cap sync android
if [ $? -ne 0 ]; then
    echo "ERROR: Capacitor sync failed!"
    exit 1
fi

echo ""
echo "Step 4: Building Android release bundle..."
cd android

./gradlew clean
./gradlew bundleRelease
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Android build failed!"
    echo ""
    echo "Possible solutions:"
    echo "1. Make sure Android Studio is installed"
    echo "2. Set JAVA_HOME environment variable"
    cd ..
    exit 1
fi

cd ..

echo ""
echo "==============================================="
echo "  BUILD SUCCESSFUL!"
echo "==============================================="
echo ""
echo "Your signed Android App Bundle is located at:"
echo "android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "Upload this file to Google Play Console!"
echo ""
