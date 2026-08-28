#!/bin/bash
#
# Rutiini Android release builder (macOS and Linux).
#
#   ./build-android.sh https://oma-palvelimesi.fi
#
# or with the address already in the environment:
#
#   VITE_API_URL=https://oma-palvelimesi.fi ./build-android.sh
#
# The Windows equivalent is build-android.bat.
set -euo pipefail

# Work from the folder this script lives in, so it does not matter where it is
# run from.
cd "$(dirname "$0")"

echo "==============================================="
echo "  Rutiini Android release builder"
echo "==============================================="
echo

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed. Get it from https://nodejs.org/"
  exit 1
fi

# The address may come as an argument or from the environment.
if [ $# -ge 1 ]; then
  export VITE_API_URL="$1"
fi

# A native build has no server to fall back on: the address is compiled into the
# bundle. npm run build:mobile refuses without it, but saying so here means the
# failure names this script's own usage rather than the inner one's.
if [ -z "${VITE_API_URL:-}" ]; then
  cat <<'MESSAGE'
ERROR: the server address is missing.

  The app is told at build time where its server is, so run either:

      ./build-android.sh https://oma-palvelimesi.fi

  or:

      VITE_API_URL=https://oma-palvelimesi.fi ./build-android.sh

MESSAGE
  exit 1
fi

echo "Server address: $VITE_API_URL"
echo

echo "Step 1 of 4: installing dependencies..."
npm install

echo
echo "Step 2 of 4: building the web app and syncing it into android/..."
# This also runs "npx cap sync", so there is no separate sync step.
npm run build:mobile

echo
echo "Step 3 of 4: checking the signing key..."

# Not created here. These are the credentials that sign the app for Google Play,
# and the file is deliberately kept out of version control.
if [ ! -f android/keystore.properties ]; then
  cat <<'MESSAGE'
ERROR: android/keystore.properties not found.

  Create the signing key once:

      cd android && node generate-keystore.cjs

  Keep the generated .jks file and its password safe: losing them means you can
  never update the app on Google Play again.

MESSAGE
  exit 1
fi

if [ ! -f android/app/rutiini-release.jks ] && [ ! -f android/rutiini-release.jks ]; then
  echo "ERROR: rutiini-release.jks not found in android/app/ or android/."
  exit 1
fi
echo "Signing key found."

echo
echo "Step 4 of 4: building the release bundle. This takes several minutes..."
cd android
./gradlew clean
./gradlew bundleRelease
cd ..

echo
echo "==============================================="
echo "  BUILD SUCCESSFUL"
echo "==============================================="
echo
echo "Signed bundle for Google Play:"
echo "  android/app/build/outputs/bundle/release/app-release.aab"
echo
echo "It talks to: $VITE_API_URL"
echo
echo "Remember to raise versionCode in android/app/build.gradle before each"
echo "upload, or Google Play will refuse the file."
echo
