# Rutiini iOS App - Build & App Store Submission Guide

> **Ennen kuin buildaat:** sovellukselle on kerrottava palvelimen osoite.
> Käytä `npm run build:mobile`, älä pelkkää `npm run build` -- puhelimessa ei ole
> palvelinta, joten ilman osoitetta sovellus ei tavoita mitään, ei edes
> kirjautumiseen. Katso [MOBILE_RELEASE.md](MOBILE_RELEASE.md).
>
> **Before building:** the app has to be told where the server is. Use
> `npm run build:mobile`, not `npm run build`.


**Date:** December 2, 2025  
**App:** Rutiini (Daycare Management System)  
**Bundle ID:** com.rutiini.app  
**Team ID:** 5YKNQGJNZ4

---

## WHAT'S BEEN UPDATED

✅ **App Icon** - New Rutiini logo (blue daycare theme)  
✅ **Info.plist** - Updated with network security settings  
✅ **capacitor.config.json** - Optimized for production  
✅ **Splash Screen** - Blue theme (#2563eb) with Rutiini branding  
✅ **CSP Headers** - Security enhancement implemented in backend  

---

## STEP-BY-STEP BUILD ON YOUR MAC

### STEP 1: Download Latest Code
```bash
# On your Mac, in the Rutiini project folder
git pull origin main  # Get the latest code with icon updates

# OR manually sync the following files changed:
# - ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png (NEW ICON)
# - ios/App/App/Info.plist (UPDATED)
```

### STEP 2: Rebuild Web App
```bash
# In project root -- VITE_API_URL is the address the app will talk to.
VITE_API_URL=https://rutiini.example.fi npm run build:mobile

# This builds dist/public/ and copies it into ios/, iOS will use it
```

### STEP 3: Update Capacitor
```bash
# In project root
npx cap sync ios

# This syncs web assets to iOS project
```

### STEP 4: Open Xcode
```bash
# Navigate to iOS project
open ios/App/App.xcworkspace

# IMPORTANT: Always open .xcworkspace (NOT .xcodeproj)
```

### STEP 5: In Xcode - Build Settings
1. Select **App** (not Pods) in left sidebar
2. Go to **General** tab
3. Set **Version:** `1.0` (or increment if updating)
4. Set **Build:** `1` (increment on each new build)
5. Verify **Bundle ID:** `com.rutiini.app`
6. Verify **Team:** Your Apple Developer account

### STEP 6: Build Archive
```
In Xcode menu:
1. Product → Archive
2. Wait for build to complete (5-10 min)
3. Will show "Archive Successful"
```

### STEP 7: Export as IPA
```
After Archive:
1. Organizer window opens automatically
2. Select your new Archive
3. Click "Distribute App"
4. Choose "App Store Connect"
5. Choose "Upload"
6. Select your Team & signing certificate
7. Click "Next" and "Upload"

OR Export locally as IPA:
1. Click "Export"
2. Choose "App Store Connect"
3. Select signing options
4. Save IPA to Downloads folder
```

---

## ALTERNATIVE: Build from Command Line

```bash
# In ios/ directory:
cd ios/App

# Set build number
CURRENT_DATE=$(date +%s)
BUILD_NUM=$((CURRENT_DATE / 1000))

# Build archive
xcodebuild archive \
  -scheme App \
  -workspace App.xcworkspace \
  -configuration Release \
  -archivePath "build/App-${BUILD_NUM}.xcarchive" \
  -derivedDataPath "build/DerivedData" \
  CODE_SIGN_STYLE="Automatic"

# Export IPA
xcodebuild -exportArchive \
  -archivePath "build/App-${BUILD_NUM}.xcarchive" \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath "build/Export"

# IPA will be at: build/Export/App.ipa
```

---

## XCODE SETTINGS TO VERIFY

### Signing & Capabilities
- ✅ Team: Your Apple Developer account
- ✅ Bundle Identifier: `com.rutiini.app`
- ✅ Signing Certificate: Automatic (preferred)
- ✅ Provisioning Profile: Automatic

### Build Settings
- ✅ Minimum iOS Deployment: 13.0+
- ✅ Swift Language: Swift 5.9+
- ✅ Deployment Target: iOS 13.0

### Capabilities (if needed)
- ✅ Push Notifications (optional - for future notifications)
- ✅ Background Modes (optional - if background sync needed)

---

## APP STORE CONNECT SETUP

### After First Upload:

1. **Go to:** https://appstoreconnect.apple.com
2. **Select:** Rutiini app
3. **Fill in:**
   - **Privacy Policy URL:** https://rutiini.com/privacy-policy
   - **Support URL:** https://rutiini.com/
   - **Manufacturer/Developer Email:** dhiouiabdelrahman@gmail.com

### App Information:
- **Name:** Rutiini
- **Subtitle:** Daycare Management System
- **Category:** Productivity
- **Requires Login:** YES
- **Age Rating:** 4+ (no mature content)

### Release Information:
- **Version Number:** 1.0
- **Build:** 1
- **Copyright:** Rutiini Software © 2026

### App Screenshots (Required):
Upload 5-7 screenshots showing:
1. Login screen
2. Dashboard
3. Child management
4. Daily entries
5. Messaging
6. User management
7. Settings

### Description:
```
Rutiini is a comprehensive daycare management system designed for 
administrators, staff, and guardians. Features include:

- Real-time child activity tracking (meals, sleep, play)
- Direct communication between staff and parents
- Trip management and approvals
- Absence and illness reporting
- Multi-language support (Finnish, English, Swedish, Arabic, Russian, Somali)
- GDPR-compliant data protection
- Secure, role-based access

Available in 6 languages for maximum accessibility across diverse communities.
```

### Keywords:
```
daycare, childcare, management, education, communication, parents, staff, activities
```

### Privacy & Security:
- **Collects User Data:** YES
- **Deletes User Account:** YES
- **GDPR Compliant:** YES

---

## TEST ACCOUNTS FOR REVIEW

Provide these to Apple reviewers:

**Daycare Code:** RUTIINI  
**Default Password:** AppleReview123!

| Role | Email | Password |
|------|-------|----------|
| Admin | appstore-admin@rutiini.com | AppleReview123! |
| Staff | appstore-staff@rutiini.com | AppleReview123! |
| Guardian | appstore-guardian@rutiini.com | AppleReview123! |

---

## SUBMISSION CHECKLIST

Before clicking "Submit for Review":

- [ ] App icon updated (Rutiini logo)
- [ ] Version number set (1.0)
- [ ] Build number set (1+)
- [ ] Privacy Policy URL added
- [ ] Support URL added
- [ ] Screenshots uploaded (5-7 min)
- [ ] Description filled in
- [ ] Keywords added
- [ ] Age rating set (4+)
- [ ] Test accounts provided in notes
- [ ] Build uploaded successfully

---

## SUBMISSION NOTES

In the "Review Notes" section, add:

```
Rutiini is a GDPR-compliant multi-tenant daycare management system.

Test Accounts (provided with correct daycare code):
- Admin: appstore-admin@rutiini.com / AppleReview123!
- Staff: appstore-staff@rutiini.com / AppleReview123!
- Guardian: appstore-guardian@rutiini.com / AppleReview123!

Daycare Code: RUTIINI (uppercase)

The app supports 6 languages: Finnish, English, Swedish, Arabic, Russian, and Somali.

All data is encrypted and GDPR-compliant. Privacy policy: rutiini.com/privacy-policy
```

---

## TROUBLESHOOTING

### Build Fails: "Code Signing Error"
```
Solution: In Xcode, set "Signing Certificate" to "Automatic"
```

### Build Fails: "ENABLE_USER_SCRIPT_SANDBOXING"
```
Solution: Already fixed - verify ios/App/App.xcodeproj/project.pbxproj
```

### IPA Too Large
```
Solution: This is normal for a full React app. iOS supports up to 4GB.
```

### App Store Connect Upload Fails
```
Solution 1: Try again (connection issue)
Solution 2: Use Transporter app instead of Xcode
Download: https://apps.apple.com/app/transporter/id1450874784
```

---

## NEXT STEPS

1. ✅ Download updated code
2. ✅ Run `VITE_API_URL=https://your-server.fi npm run build:mobile` (web assets + sync)
4. ✅ Open `ios/App/App.xcworkspace`
5. ✅ Build Archive
6. ✅ Upload to App Store Connect
7. ✅ Fill in app metadata
8. ✅ Submit for Review
9. ✅ Wait 1-3 days for Apple approval
10. ✅ Launch day! 🚀

---

## QUESTIONS?

Email: dhiouiabdelrahman@gmail.com  
Website: rutiini.com

**Status:** Ready for App Store submission ✅
