# Rutiini Mobile App Deployment Guide

> **Ennen kuin buildaat:** sovellukselle on kerrottava palvelimen osoite.
> Käytä `npm run build:mobile`, älä pelkkää `npm run build` -- puhelimessa ei ole
> palvelinta, joten ilman osoitetta sovellus ei tavoita mitään, ei edes
> kirjautumiseen. Katso [MOBILE_RELEASE.md](MOBILE_RELEASE.md).
>
> **Before building:** the app has to be told where the server is. Use
> `npm run build:mobile`, not `npm run build`.


This guide explains how to build and publish Rutiini to the Apple App Store and Google Play Store using Capacitor.

## Prerequisites

### For iOS (App Store)
- macOS computer with Xcode 15+ installed
- Apple Developer Program membership ($99/year)
- App Store Connect account

### For Android (Google Play Store)
- Android Studio installed (macOS, Windows, or Linux)
- Google Play Developer account ($25 one-time fee)
- Java Development Kit (JDK) 17+ (comes with Android Studio)

---

## ANDROID BUILD - Step by Step

### Step 1: Get the Project

1. Clone the repository: `git clone https://github.com/cryptoaigent/Rutiini.com.git`
2. Click "Download as zip"
3. Extract the zip to a folder (e.g., `C:\Users\YourName\Downloads\Rutiini`)

### Step 2: Open Terminal/Command Prompt

1. Open **Command Prompt** or **PowerShell** on Windows
2. Navigate to the project folder:
   ```bash
   cd C:\Users\YourName\Downloads\Rutiini
   ```

### Step 3: Install Dependencies

Run this command (requires Node.js installed):
```bash
npm install
```

Wait until it finishes (may take 2-5 minutes).

### Step 4: Build the Web App for a Phone

```bash
VITE_API_URL=https://rutiini.example.fi npm run build:mobile
```

`VITE_API_URL` is the address of your deployment -- the one a phone can reach over
the internet. The app has no server of its own, so without this it cannot sign in.
The command builds the web assets and syncs them into `android/` and `ios/`.

### Step 5: Sync to Android

```bash
npx cap sync android
```

This copies the web app to the Android project.

### Step 6: Create Keystore (Required for Google Play)

Run this command to create a signing key:

**On Windows (PowerShell):**
```powershell
cd android
& "$env:JAVA_HOME\bin\keytool.exe" -genkey -v -keystore rutiini-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rutiini
```

**If JAVA_HOME not set, try this path:**
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore rutiini-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rutiini
```

**On Mac/Linux:**
```bash
cd android
keytool -genkey -v -keystore rutiini-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rutiini
```

When prompted:
- Enter a password (remember it!)
- Answer the questions (name, organization, etc.)
- Type "yes" to confirm

### Step 7: Update keystore.properties

Edit the file `android/keystore.properties`:
```
storeFile=rutiini-release.jks
storePassword=YOUR_PASSWORD_HERE
keyAlias=rutiini
keyPassword=YOUR_PASSWORD_HERE
```

Replace `YOUR_PASSWORD_HERE` with the password you chose.

### Step 8: Build Signed Bundle

Run in the `android` folder:

**On Windows:**
```bash
.\gradlew.bat bundleRelease
```

**On Mac/Linux:**
```bash
./gradlew bundleRelease
```

Wait for "BUILD SUCCESSFUL" message.

### Step 9: Find Your AAB File

The signed bundle is located at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

This is the file you upload to Google Play Store!

---

## ALTERNATIVE: Build in Android Studio (GUI)

If the command line doesn't work:

1. Open Android Studio
2. Click **File** > **Open**
3. Select the `android` folder from your project
4. Wait for Gradle sync to complete
5. Click **Build** > **Generate Signed Bundle / APK**
6. Select **Android App Bundle**
7. Click **Next**
8. Click **Create new...** for keystore
9. Fill in the details and save
10. Select **release** build type
11. Click **Finish**

---

## Upload to Google Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app:
   - App Name: **Rutiini**
   - Default Language: **Finnish**
   - App Category: **Education**
3. Go to **Release** > **Production**
4. Click **Create new release**
5. Upload the `app-release.aab` file
6. Fill in release notes
7. Complete the store listing with screenshots
8. Submit for review

---

## iOS BUILD - Step by Step

### Prerequisites
- macOS with Xcode 15+
- Apple Developer account

### Step 1: Build and Sync (same as Android steps 1-5)

### Step 2: Open in Xcode
```bash
npx cap open ios
```

### Step 3: Configure Signing
1. Select the "App" target
2. Go to "Signing & Capabilities"
3. Select your Team (Apple Developer account)
4. Set Bundle Identifier: `com.rutiini.app`

### Step 4: Build and Archive
1. Select "Product" > "Archive"
2. Once archived, click "Distribute App"
3. Choose "App Store Connect"
4. Follow the wizard to upload

### Step 5: Submit in App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app with bundle ID `com.rutiini.app`
3. Fill in app information
4. Upload screenshots
5. Submit for review

---

## Troubleshooting

### "JAVA_HOME is not set"
Find Java in Android Studio:
1. Open Android Studio
2. Go to **File** > **Settings** > **Build, Execution, Deployment** > **Build Tools** > **Gradle**
3. Look at "Gradle JDK" path
4. Set that path as JAVA_HOME

**Windows PowerShell:**
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

### "No matching variant of project :capacitor-android"
Run these commands in order:
```bash
npm install
npx cap sync android
```

### "Keystore file not found"
Make sure the keystore file is in the `android` folder and the path in `keystore.properties` is correct.

### Build errors
Try cleaning the project:
```bash
cd android
.\gradlew.bat clean
.\gradlew.bat bundleRelease
```

---

## App Store Requirements Checklist

### Android (Google Play)
- [ ] App icons (all required sizes) - already included
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone and tablet)
- [ ] Privacy Policy URL
- [ ] Short description (up to 80 characters)
- [ ] Full description (up to 4000 characters)
- [ ] Content rating questionnaire completed

### iOS (App Store)
- [ ] App icons (all required sizes)
- [ ] Screenshots (iPhone and iPad)
- [ ] Privacy Policy URL
- [ ] App description (up to 4000 characters)
- [ ] Keywords (up to 100 characters)
- [ ] Support URL
- [ ] Age Rating questionnaire completed

---

## Updating the App

When you make changes:

1. Build and sync: `VITE_API_URL=https://your-server.fi npm run build:mobile`
3. Increment version in `android/app/build.gradle`:
   ```gradle
   versionCode 2
   versionName "1.1.0"
   ```
4. Build and submit update

---

## Support

For Capacitor documentation: https://capacitorjs.com/docs
