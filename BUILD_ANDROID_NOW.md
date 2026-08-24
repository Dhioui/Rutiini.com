# START HERE - Android App Build Instructions

> **Ennen buildia / before building:** aja `npm run build:mobile` (ei pelkkä
> `npm run build`) ja anna `VITE_API_URL`, muuten sovellus ei tavoita palvelinta.
> Katso [MOBILE_RELEASE.md](MOBILE_RELEASE.md).


## What You're Building
A signed Android app bundle (.aab file) for Google Play Store submission.

## Requirements
- ✅ Android Studio installed (you have it)
- ✅ Node.js installed
- ✅ A local clone of this repository

---

## FASTEST METHOD - Windows (3 clicks!)

### Step 1: Download
- Clone the repository: `git clone https://github.com/cryptoaigent/Rutiini.com.git`
- Extract it (right-click → "Extract All")

### Step 2: Open Folder
- Open the extracted folder
- Navigate to the `android` subfolder

### Step 3: Build
- **Double-click `build-release.bat`**
- Done! Wait for it to finish (~10 minutes)

**Your signed bundle:** `android\app\build\outputs\bundle\release\app-release.aab`

---

## Manual Method (If script fails)

### Step 1: Open PowerShell
- Press **Windows Key + R**
- Type: `powershell`
- Press **Enter**

### Step 2: Navigate to Android Folder
Copy and paste this (replace path if needed):
```powershell
cd "C:\Users\yaser\Downloads\Rutiini\Rutiini\android"
```

### Step 3: Set Java Location
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

### Step 4: Build
```powershell
.\gradlew.bat bundleRelease
```

Wait until you see: **"BUILD SUCCESSFUL"** ✅

**Your file:** `app\build\outputs\bundle\release\app-release.aab`

---

## What's Next?

When you have the `app-release.aab` file:

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app or select Rutiini
3. Go to **Release** → **Production**
4. Click **Create new release**
5. Upload `app-release.aab`
6. Fill in release notes
7. Complete store listing (screenshots, description, etc.)
8. Click **Submit for review**

---

## Help!

| Problem | Solution |
|---------|----------|
| "BUILD FAILED" | Delete `android/build` folder and try again |
| "JAVA_HOME error" | Make sure `C:\Program Files\Android\Android Studio\jbr` exists |
| Can't find AAB file | Check: `android\app\build\outputs\bundle\release\` |
| Script won't run | Try manual method (PowerShell) above |

---

Done! You've got this! 🚀
