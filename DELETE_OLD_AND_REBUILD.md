# Step-by-Step: Delete Old File & Rebuild

> **Ennen buildia / before building:** aja `npm run build:mobile` (ei pelkkä
> `npm run build`) ja anna `VITE_API_URL`, muuten sovellus ei tavoita palvelinta.
> Katso [MOBILE_RELEASE.md](MOBILE_RELEASE.md).


---

## STEP 1: Open File Explorer

1. Press: `Windows + E` (opens File Explorer)
2. You should see your project folder

---

## STEP 2: Navigate to the Folder

1. In the address bar at the top, type:
```
android\app\build\outputs\bundle\release
```

2. Press: `Enter`

3. You should see one file: `app-release.aab`

---

## STEP 3: Delete the Old File

1. Right-click on `app-release.aab`
2. Click: **Delete** (or press Delete key)
3. Click: **Yes** (confirm deletion)

---

## STEP 4: Close File Explorer

1. Click the X button to close

---

## STEP 5: Open Your Project Folder

1. Go to your main project folder (where build-android.bat is located)

---

## STEP 6: Run the Build Script

1. Find: `build-android.bat`
2. Double-click it
3. A command window will open
4. **Wait** 5-10 minutes for it to finish
5. You'll see: **"BUILD SUCCESSFUL!"**
6. Press any key to close the window

---

## STEP 7: Verify New File is Created

1. Open File Explorer again
2. Navigate to:
```
android\app\build\outputs\bundle\release
```

3. You should see: `app-release.aab` (new file, created just now)

---

## STEP 8: Upload to Google Play

1. Open browser and go to: **https://play.google.com/console**

2. Sign in with: **dhiouiabdelrahman@gmail.com**

3. Click: **Rutiini** app

4. Click menu on left: **Release**

5. Click: **Production**

6. Click blue button: **"Create new release"**

7. Click: **"Add bundle or APK"**

8. Drag the `app-release.aab` file here (or click to browse and select it)

9. Wait for upload (you'll see checkmark ✓)

10. Scroll down and type Release Notes:
```
Rutiini v1.0.0 - Ensimmäinen versio
```

11. Click: **"Review release"**

12. Click: **"Submit"**

13. Done! ✅ (Wait 24-48 hours for app to go live)

---

## Summary:

✓ Delete old file
✓ Run build
✓ Upload to Google Play
✓ Done!
