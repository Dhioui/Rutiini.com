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
echo "Step 2: Building web app and syncing to Android..."
echo ""
echo "  The app needs to know where the server is. Set VITE_API_URL to your"
echo "  deployment's address, for example:"
echo ""
echo "      VITE_API_URL=https://rutiini.example.fi ./build-android.sh"
echo ""
npm run build:mobile
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "Step 3: Building Android release bundle..."
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
