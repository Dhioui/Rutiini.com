# Rutiini Android Build - Easy Method

> **Ennen buildia / before building:** aja `npm run build:mobile` (ei pelkkä
> `npm run build`) ja anna `VITE_API_URL`, muuten sovellus ei tavoita palvelinta.
> Katso [MOBILE_RELEASE.md](MOBILE_RELEASE.md).


## ONE-CLICK BUILD FOR WINDOWS

**This is the easiest way to build your signed Android app bundle.**

### Step 1: Download Project
1. Clone the repository
2. Click **...** (three dots) on Files → "Download as zip"
3. Extract to folder (e.g., `C:\Rutiini`)

### Step 2: Run Build Script (That's It!)

1. Open the `android` folder
2. **Double-click: `build-release.bat`**

That's it! The script will:
- ✅ Set up Java automatically
- ✅ Clean old builds
- ✅ Build signed bundle
- ✅ Show you where the file is

### What You Get

When it finishes, your signed app bundle is at:
```
android\app\build\outputs\bundle\release\app-release.aab
```

Upload this file to Google Play Console! 🎉

---

## IF BUILD FAILS

### Try clearing cache first:

1. Open `android` folder
2. Delete the `build` folder (entire folder)
3. Try again: double-click `build-release.bat`

### Still failing?

Open **Command Prompt** and run:
```
cd C:\Rutiini\android
build-release.bat
```

This shows you detailed error messages.

---

## MAC / LINUX

1. Open Terminal
2. Navigate to project: `cd ~/Downloads/Rutiini/android`
3. Run: `bash build-release.sh`
4. Wait for "BUILD SUCCESSFUL"
5. Your file is at: `app/build/outputs/bundle/release/app-release.aab`

---

## Troubleshooting

**"BUILD FAILED" appears?**
- Close and try again
- Make sure you have Android Studio installed
- Try deleting the `android/build` folder and retry

**Can't find app-release.aab?**
- Build must say "BUILD SUCCESSFUL" first
- File is in: `android/app/build/outputs/bundle/release/app-release.aab`
- Use Windows Explorer to search for it

**Need more help?**
Look at MOBILE_DEPLOYMENT.md for detailed explanations
