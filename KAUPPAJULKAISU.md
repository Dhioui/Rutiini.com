# Kauppajulkaisu — valmis paketti

Kaikki mitä Google Play ja App Store pyytävät, valmiiksi kirjoitettuna. Kopioi ja
liitä. Ainoat kohdat joissa sinun täytyy itse päättää tai kirjoittaa jotain on
merkitty **[SINÄ]**.

---

## 1. Mitä vain sinä voit tehdä

Nämä eivät ole työläitä, mutta niitä ei voi tehdä puolestasi.

| Asia | Miksi vain sinä |
|---|---|
| **Play Console -tili**, 25 $ kertamaksu | Henkilöllisyyden vahvistus ja sopimus sinun nimissäsi |
| **Apple Developer -tili**, 99 $/v | Sama, ja vaatii Applen sopimuksen hyväksynnän |
| **Palvelin pystyyn** HTTPS-osoitteeseen | Vaatii oman hosting-tilin ja verkkotunnuksen |
| **Allekirjoitusavain** (`node generate-keystore.cjs`) | Avain saa syntyä vain sinun koneellasi ja jäädä sinne |
| **Data Safety -lomakkeen lähetys** | Oikeudellinen vakuutus yrityksesi tietojenkäsittelystä |
| **Tiedostojen lataus kauppaan** | Vaatii kirjautumisen tileillesi |

Kaikki muu alla on valmiina.

---

## 2. Kuvakaappaukset — valmiit

Kansiossa `store-screenshots/`, luotu oikeasta sovelluksesta oikealla datalla:

| Kansio | Mitat | Mihin |
|---|---|---|
| `ios-6.9/` | 1320 × 2868 | App Store, iPhone 6.9" |
| `ios-6.5/` | 1242 × 2688 | App Store, iPhone 6.5" |
| `android-phone/` | 1080 × 1920 | Google Play, puhelin |

Kahdeksan kuvaa per koko, numeroitu esitysjärjestykseen: johtajan etusivu,
lapset, merkinnän teko, ruokalista, sitten huoltajan näkymät.

Luo uudelleen milloin tahansa: `./e2e/run.sh store-shots.mjs`

> Tarkista Applen ja Googlen voimassa olevat kokovaatimukset konsolista ennen
> latausta — etenkin Apple muuttaa niitä ajoittain.

---

## 3. Tietosuojaseloste — sinulla on jo

Sovelluksessa on julkinen tietosuojaseloste ja käyttöehdot, jotka eivät vaadi
kirjautumista. Kun palvelin on pystyssä, URL-osoitteet ovat:

```
https://palvelimesi.fi/privacy-policy
https://palvelimesi.fi/terms-of-service
```

Molemmat kaupat pyytävät ensimmäistä. **[SINÄ]** Lue seloste läpi ja tarkista
että yrityksesi nimi ja yhteystiedot ovat oikein.

---

## 4. Listaustekstit

### Sovelluksen nimi
```
Rutiini
```

### Lyhyt kuvaus (Play, enintään 80 merkkiä)
```
Päiväkodin arki, viestit ja poissaolot yhdessä paikassa. GDPR-yhteensopiva.
```
*(78 merkkiä)*

### Tekstitys / Subtitle (App Store, enintään 30 merkkiä)
```
Päiväkodin hallinta
```

### Pitkä kuvaus (molemmat kaupat)

```
Rutiini kokoaa päiväkodin arjen yhteen paikkaan: päivän merkinnät, poissaolot,
viestit huoltajien ja henkilökunnan välillä, ruokalistan, retket ja lomakkeet.

HUOLTAJALLE
• Näet päivän merkinnät omasta lapsestasi: unet, ruokailut, leikit
• Ilmoita poissaolo muutamalla napautuksella
• Viesti suoraan henkilökunnalle
• Katso päivän ja viikon ruokalista
• Vastaa retkilupiin ja lomakkeisiin
• Hallitse omia tietojasi ja pyydä ne ulos tai poistettavaksi

HENKILÖKUNNALLE
• Kirjaa päivän tapahtumat nopeasti pikamerkinnöillä
• Näe ryhmän tilanne yhdellä silmäyksellä
• Vastaanota poissaoloilmoitukset heti
• Viesti huoltajien kanssa
• Julkaise tiedotteet ja retket

PÄIVÄKODIN JOHTAJALLE
• Läsnäolo ja merkinnät koko päiväkodista
• Käyttäjien hallinta
• Raportit CSV-muodossa
• Auditointiloki

TIETOSUOJA
Rutiini on rakennettu tietosuoja edellä. Henkilötiedot pysyvät päiväkodin
sisällä: järjestelmän ylläpitäjä ei pääse käsiksi lasten tai huoltajien
tietoihin lainkaan. Kaikki tietoihin kohdistuvat toimet kirjautuvat
auditointilokiin. Tiedot poistetaan automaattisesti säilytysaikojen umpeuduttua,
ja huoltaja voi pyytää omat tietonsa ulos tai poistettavaksi suoraan
sovelluksesta.

KIELET
Suomi, englanti, ruotsi, arabia, venäjä ja somali.

Rutiini vaatii päiväkodin tunnukset. Ota yhteyttä päiväkotiisi saadaksesi
käyttöoikeuden.
```

**[SINÄ]** Viimeinen kappale olettaa että päiväkodit ostavat palvelun ja jakavat
tunnukset. Muuta jos myyt toisin.

### Avainsanat (App Store, enintään 100 merkkiä, pilkuin)
```
päiväkoti,varhaiskasvatus,lapset,huoltaja,poissaolo,viestintä,päivähoito,esikoulu
```

### Kategoria
- Play: **Koulutus** (Education)
- App Store: **Koulutus** (Education)

---

## 5. Data Safety -lomake (Play) — luonnos

Perustuu siihen mitä sovellus **oikeasti** tallentaa (`shared/schema.ts`).
**[SINÄ]** Käy läpi ja vahvista ennen lähetystä — tämä on oikeudellinen vakuutus.

### Kerätäänkö tietoja? **Kyllä**
### Salataanko siirrossa? **Kyllä** (HTTPS)
### Voiko käyttäjä pyytää tietojen poistoa? **Kyllä** (sovelluksessa, `/gdpr`)

| Tietotyyppi | Kerätään | Käyttötarkoitus | Pakollinen |
|---|---|---|---|
| Nimi | Kyllä | Sovelluksen toiminta | Kyllä |
| Sähköpostiosoite | Kyllä | Sovelluksen toiminta, tilinhallinta | Kyllä |
| Muut tunnistetiedot (laitetunnus push-viesteihin) | Kyllä | Ilmoitukset | Ei |
| Viestit (käyttäjien väliset) | Kyllä | Sovelluksen toiminta | Kyllä |
| Valokuvat | Kyllä, jos liitetty viestiin | Sovelluksen toiminta | Ei |
| Terveystiedot | Kyllä — poissaolon syy voi sisältää sairaustiedon | Sovelluksen toiminta | Ei |
| Lapsen nimi ja syntymäaika | Kyllä | Sovelluksen toiminta | Kyllä |

**Ei kerätä:** sijaintia, maksutietoja, yhteystietoluetteloa, selaushistoriaa,
hakuhistoriaa, mainostunnisteita. Tietoja **ei jaeta kolmansille osapuolille**
eikä käytetä mainontaan.

> Huomaa: poissaolon syy on vapaa tekstikenttä ja tyyppi voi olla "sairaus",
> joten se lasketaan terveystiedoksi. Älä jätä tätä ilmoittamatta — se on
> tavallinen hylkäyssyy.

---

## 6. Sisältöluokitus ja kohdeyleisö

**[SINÄ]** Nämä ovat kyselyitä joihin vastataan konsolissa, mutta tässä
tosiasiat joiden pohjalta vastaat:

- Sovelluksessa **ei ole** väkivaltaa, seksuaalista sisältöä, päihteitä,
  uhkapelejä eikä käyttäjien välistä julkista sisältöä.
- Siinä **on** käyttäjien välistä yksityisviestintää (huoltaja ↔ henkilökunta).
- **Kohdeyleisö on aikuiset** — henkilökunta ja huoltajat. Lapset eivät käytä
  sovellusta. Tämä on tärkeä erottelu: sovellus *käsittelee* lasten tietoja mutta
  ei ole *suunnattu* lapsille. Vastaa kohdeyleisökyselyyn sen mukaisesti, äläkä
  merkitse sitä lapsille suunnatuksi — se toisi Families-ohjelman vaatimukset
  jotka eivät sovi tähän.

---

## 7. Julkaisujärjestys

1. **[SINÄ]** Palvelin pystyyn HTTPS-osoitteeseen, tarkista että toimii selaimessa
2. **[SINÄ]** Play Console -tili (25 $)
3. **[SINÄ]** `cd android` → `node generate-keystore.cjs` → salasana talteen muualle
4. **[SINÄ]** Tarkista `versionCode` tiedostossa `android/app/build.gradle`
5. **[SINÄ]** `build-android.bat https://palvelimesi.fi`
6. **[SINÄ]** Lataa `.aab`, liitä tämän tiedoston tekstit, lataa kuvat kansiosta
   `store-screenshots/android-phone/`
7. Odota arviointi

App Store vasta tämän jälkeen, ja se vaatii Macin — katso `MOBILE_RELEASE.md`.
