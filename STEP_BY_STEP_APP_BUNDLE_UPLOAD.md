# Step-by-Step: Upload App Bundle to Google Play 📱

## Your AAB File Location:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## STEP 1: Open Google Play Console

1. Go to: **https://play.google.com/console**
2. Sign in with your Google account (dhiouiabdelrahman@gmail.com)
3. You should see your **Rutiini** app listed
4. Click on **Rutiini** to open it

---

## STEP 2: Go to "Internal testing" Release

1. On the left menu, click **Release** → **Testing**
2. Click **Internal testing** (this is the easiest way to test before full release)
3. You should see a section that says **"Create new release"**
4. Click **"Create new release"** button

---

## STEP 3: Upload Your AAB File

1. You'll see a page that says **"Add bundle or APK"**
2. Click the **file upload area** (or drag and drop)
3. Browse to your file:
   - **Windows**: `android\app\build\outputs\bundle\release\app-release.aab`
   - **Mac**: `android/app/build/outputs/bundle/release/app-release.aab`
   - **Linux**: `android/app/build/outputs/bundle/release/app-release.aab`
4. Click **Open** (the file will upload)
5. **Wait** for upload to complete (you'll see a checkmark ✓)

---

## STEP 4: Fill in Release Notes (Finnish)

1. After upload completes, you'll see **"Release notes"** field
2. Click in the text box and enter (in Finnish):

```
Rutiini v1.0.0 - Ensimmäinen versio

Ominaisuudet:
- Lapsiryhmien hallinta
- Päivittäiset merkinnät
- Viestintä huoltajien kanssa
- Ilmoitusjärjestelmä
```

Or simply:
```
Rutiini - Päivähoidon hallintajärjestelmä
```

3. Click **Save**

---

## STEP 5: Review Your Release

1. Google Play will show you:
   - App size (usually 10-50 MB)
   - Android version compatibility
   - Device compatibility
2. Everything should show ✓ (green checkmark)
3. If you see any **red warnings**, fix them before proceeding

---

## STEP 6: Submit for Internal Testing

1. Scroll down and click **"Review release"** or **"Submit"** button
2. You'll see a **summary** of your app:
   - App name: Rutiini ✓
   - Bundle file: app-release.aab ✓
   - Release notes: [Your text] ✓
3. Click the final **"Submit"** or **"Release to internal testing"** button
4. **Wait** for the deployment (usually 5-10 minutes)

---

## STEP 7: Test the Release (Optional)

1. After deployment, you can test on an Android device:
   - Click **"Internal testing"** → **"Invite testers"**
   - Add your email
   - Click the link to join the beta
   - Install from Play Store
2. Test that the app works correctly

---

## STEP 8: Move to Production (Full Release)

After confirming it works (or if you're ready immediately):

1. Go to **Release** → **Production**
2. Click **"Create new release"**
3. Upload the same `app-release.aab` file
4. Add release notes in Finnish
5. Upload **screenshots** (the 10 images we created):
   - Phone screenshots (5)
   - Tablet screenshots (3)
   - Desktop screenshots (2)
6. Click **"Review release"** → **"Submit"**
7. Click final **"Submit"** button

---

## STEP 9: Google Play Review

1. Your app goes to **"In review"** status
2. **Wait 24-48 hours** (Google's automated review)
3. You'll get an **email** notification when approved
4. App appears on **Google Play Store** automatically! 🎉

---

## STEP 10: Tell Your Daycares! 📢

Once approved, share the Google Play link:
```
https://play.google.com/store/apps/details?id=com.rutiini.app
```

(The exact ID depends on what you set in `capacitor.config.ts`)

---

## Important Notes:

✅ **DO:**
- Use the same AAB file every time
- Add Finnish release notes
- Upload screenshots for best conversion
- Test on at least one real device if possible

❌ **DON'T:**
- Modify the AAB file after uploading
- Use lorem ipsum text
- Skip filling required fields
- Upload invalid screenshots

---

## Troubleshooting:

| Problem | Solution |
|---------|----------|
| "Invalid AAB file" | Make sure file is from `app-release.aab` (not app-debug.aab) |
| "Upload failed" | Refresh page, try again |
| "Missing screenshots" | Upload 5+ phone screenshots |
| "App stuck on 'In review'" | Wait 24 hours, then contact support |
| "Version code conflict" | Increment versionCode in `android/app/build.gradle` |

---

## Time Estimate:

- Upload AAB: **2 minutes**
- Add screenshots: **5 minutes**
- Fill in details: **3 minutes**
- Submit: **1 minute**
- Google review: **24-48 hours**

**Total active time: ~10 minutes** ⏱️

---

## Next Step:

Ready? Follow **STEP 1 - STEP 10** above! 🚀

If you get stuck on any step, let me know which step number! 💪
