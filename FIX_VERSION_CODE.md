# Step-by-Step: Fix "Code Already Used" Error

## STEP 1: Open the File

1. Go to your project folder
2. Open: `android`
3. Open: `app`
4. Find file: `build.gradle`
5. Right-click on it → **Open with** → **Notepad** (or any text editor)

---

## STEP 2: Find the Version Code

Look for this line (should be near the top):
```
versionCode 1
```

---

## STEP 3: Change the Number

Change from:
```
versionCode 1
```

To:
```
versionCode 2
```

---

## STEP 4: Save the File

1. Press: `Ctrl + S`
2. Close the file

---

## STEP 5: Rebuild

1. Find: `build-android.bat` in your project folder
2. Double-click it
3. Wait 5-10 minutes for build to finish
4. When done, you'll see: **"BUILD SUCCESSFUL!"**

---

## STEP 6: Find New AAB File

After build finishes:
1. Open File Explorer
2. Go to: `android\app\build\outputs\bundle\release`
3. You'll see: `app-release.aab` (this is the NEW one)
4. Copy it to Desktop

---

## STEP 7: Upload to Google Play

1. Go to: **https://play.google.com/console**
2. Sign in
3. Click: **Rutiini** app
4. Click: **Release** (left menu)
5. Click: **Production**
6. Click blue button: **"Create new release"**
7. Click: **"Add bundle or APK"**
8. Drag the NEW `app-release.aab` file into the box
9. Add Release Notes:
```
Rutiini v1.0.0 - Ensimmäinen versio
```
10. Click: **"Review release"**
11. Click: **"Submit"**

---

## STEP 8: Done!

Wait 24-48 hours → Your app goes live! ✅

---

## Summary:

1. ✓ Edit `build.gradle` (change versionCode 1 → 2)
2. ✓ Save file
3. ✓ Run `build-android.bat`
4. ✓ Wait for build
5. ✓ Copy new `app-release.aab`
6. ✓ Upload to Google Play
7. ✓ Submit
8. ✓ Done!
