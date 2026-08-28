# Rutiini mobiilijulkaisu — App Store ja Google Play

Tämä on ainoa ohje, jota tarvitset sovelluksen buildaamiseen puhelimelle. Muut
mobiilidokumentit ovat vanhempia ja niiden buildikomennot ohjaavat väärään
lopputulokseen; tämä korvaa ne siltä osin.

---

## 1. Buildaa aina näin

```bash
VITE_API_URL=https://oma-palvelimesi.fi npm run build:mobile
```

**Miksi tämä eikä `npm run build`:** selainversion tarjoilee sama palvelin kuin
API:n, joten se pärjää suhteellisilla poluilla (`/api/...`). Puhelimessa ei ole
mitään palvelinta — Capacitor tarjoilee sovelluksen omasta `localhost`-
originistaan, joten `/api/children` osoittaisi puhelimeen itseensä eikä tavoittaisi
mitään. Sovellukselle on siis kerrottava buildin yhteydessä, missä palvelin on.

Komento kieltäytyy, jos osoite puuttuu, on `http`, tai osoittaa `localhostiin` —
eli rikkinäistä bundlea ei pääse vahingossa lataamaan kauppaan.

Sen jälkeen:

- **Android:** avaa `android/` Android Studiossa → Build → Generate Signed Bundle
  (tai `./build-android.sh`)
- **iOS:** avaa `ios/App/App.xcworkspace` Xcodessa → Product → Archive

Buildaus on aina kaksivaiheinen: ensin `build:mobile` (web-tiedostot), sitten
Android Studio / Xcode (natiivipaketti). Web-tiedostot eivät ole versionhallinnassa
-- ne ovat buildin tulos -- joten tuoreessa klonissa niitä ei ole ennen ensimmäistä
`build:mobile`-ajoa. `android/build-release.sh` ja `.bat` tarkistavat tämän ja
kieltäytyvät, koska ilman niitä syntyisi asennuskelpoinen sovellus jonka ruutu on
tyhjä.

### Android ilman Android Studiota

CI buildaa Android-sovelluksen jokaisella pushilla ja tallentaa APK:n
artefaktiksi (*Actions → ajo → Artifacts → `rutiini-debug-apk`*). Se on
debug-versio: hyvä asennettavaksi puhelimeen testiä varten, ei kauppaan.

Kun haluat APK:n joka puhuu omalle palvelimellesi, käynnistä ajo käsin:
*Actions → CI → Run workflow* ja anna `api_url`-kenttään palvelimesi osoite.
Osoite leipoutuu bundleen buildin yhteydessä, joten sitä ei voi vaihtaa
jälkikäteen ilman uutta buildia. Vaihtoehtoisesti aseta repositorion muuttuja
`MOBILE_API_URL`, jolloin jokainen ajo käyttää sitä.

Kauppaan menevä allekirjoitettu bundle tehdään edelleen omalla koneella, koska
se vaatii allekirjoitusavaimen jota ei säilytetä versionhallinnassa.

---

## 2. Mitä sinun pitää tehdä ennen ensimmäistä julkaisua

Nämä vaativat sinun tunnuksesi — näitä ei voi tehdä koodissa puolestasi.

### Palvelin

| Asia | Miksi |
|---|---|
| `VITE_API_URL` osoittaa julkiseen HTTPS-osoitteeseen | ilman tätä sovellus ei kirjaudu |
| `CORS_ORIGIN` asetettu palvelimella | rajaa, mitkä sivustot saavat kutsua API:a; mobiilioriginit sallitaan aina automaattisesti |
| `JWT_SECRET`, `SMTP_HOST` | palvelin ei käynnisty ilman näitä tuotannossa |

### Android (Google Play)

1. **`google-services.json`** Firebase-projektista → `android/app/google-services.json`.
   Ilman tätä push-ilmoitukset eivät toimi. Muu sovellus toimii normaalisti.
2. **`versionCode` nostettava** jokaista latausta kohden tiedostossa
   `android/app/build.gradle`. Nykyinen arvo on `4`. Jos Play sanoo *"Version code
   4 has already been used"*, nosta seuraavaan vapaaseen numeroon. **En muuttanut
   tätä puolestasi, koska en voi tietää mitkä numerot on jo ladattu.**
3. **Allekirjoitusavain**: `android/keystore.properties` (ei versionhallinnassa).

### iOS (App Store)

1. **Push Notifications -capability** on nyt linkitetty projektiin
   (`CODE_SIGN_ENTITLEMENTS = App/App.entitlements`). Xcode lisää sen App ID:hen
   automaattisesti, kun allekirjoitus on *Automatic* — se on jo asetettu.
   Tarkista Xcodessa: App → Signing & Capabilities → **Push Notifications** näkyy
   listassa.
2. **APNs-avain** (`.p8`) Apple Developer -portaalista → lataa Firebase-projektiin
   (Project settings → Cloud Messaging → APNs Authentication Key). Ilman tätä iOS ei
   saa push-viestejä.
3. **Versionumerot** Xcodessa: `MARKETING_VERSION` (nyt `1.0`) ja
   `CURRENT_PROJECT_VERSION` (nyt `1`). Nosta build-numeroa joka latauksella.

### Palvelin (push)

`FCM_SERVICE_ACCOUNT` = Firebase service account -JSON (suoraan tai base64).
Ilman tätä ilmoitukset kirjautuvat sovelluksen sisälle mutta puhelimeen ei lähde
mitään.

---

## 3. Mitä tässä korjattiin

Nämä olivat rikki ennen kuin sovellusta olisi voinut myydä:

- **Sovellus ei tavoittanut palvelinta lainkaan.** Kaikki 8 verkkokutsua käyttivät
  suhteellisia polkuja, jotka natiivibuildissa osoittavat puhelimeen. Kirjautuminen
  ei olisi toiminut.
- **CORS esti mobiilipyynnöt.** Palvelin vastasi `Access-Control-Allow-Origin: *`
  yhdessä `credentials: true`:n kanssa — selain hylkää sellaisen vastauksen aina.
  Selainversio ei paljastanut tätä, koska se on samassa originissa.
- **Android ei koskaan kysynyt lupaa ilmoituksiin.** `POST_NOTIFICATIONS` puuttui
  manifestista, joten Android 13+ (käytännössä kaikki nykylaitteet) hylkäsi luvan
  näyttämättä kysymystä.
- **Push-token hukkui.** Rekisteröinti ajettiin käynnistyksessä ennen kirjautumista,
  joten token ei löytänyt istuntoa johon liittyä — eikä mikään rekisteröinyt
  uudelleen. Uusi asennus ei saanut ilmoituksia lainkaan.
- **Uloskirjautuminen jätti tokenin voimaan.** Yhteiskäyttöisellä puhelimella
  seuraava käyttäjä olisi saanut edellisen perheen ilmoitukset.
- **iOS-entitlement ei ollut linkitetty projektiin**, joten iOS-buildissa ei ollut
  `aps-environment`-oikeutta eikä push voinut toimia.
