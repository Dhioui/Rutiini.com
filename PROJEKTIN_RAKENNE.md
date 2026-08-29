# Projektin rakenne — mikä on mitä

Tämä tiedosto vastaa yhteen kysymykseen: **missä mikäkin asia on.** Ei
buildiohjeita (ne ovat `MOBILE_RELEASE.md`:ssä) eikä asennusohjeita (ne ovat
`README.md`:ssä).

---

## Ensin se hämäävin asia

**Web-sovellus ja palvelin eivät ole erillisiä projekteja.** Yksi Express-prosessi
tarjoilee sekä API:n että selainkäyttöliittymän. Kun julkaiset palvelimen,
julkaiset samalla web-sovelluksen — erillistä frontend-julkaisua ei ole.

Puhelinsovellukset eivät myöskään ole omaa koodiaan. Ne ovat kuoria, joiden sisällä
pyörii täsmälleen sama `client/`-koodi kuin selaimessa. Siksi ne tarvitsevat
`VITE_API_URL`:n: kuori ei kanna palvelinta mukanaan, vaan soittaa siihen samaan
osoitteeseen jossa web-versio on.

```
                    ┌──────────────┐
                    │   client/    │   yksi käyttöliittymä
                    └──────┬───────┘
                           │ sama koodi kolmessa paikassa
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   selain            android/            ios/
   (server/          (kuori)             (kuori)
    tarjoilee)          │                   │
        │               └─── VITE_API_URL ──┘
        │                        │
        └────────────┬───────────┘
                     ▼
              ┌─────────────┐
              │   server/   │  API + tietokanta
              └─────────────┘
```

---

## Kansiot

| Kansio | Mitä siellä on |
|---|---|
| `client/` | Selainsovellus, React. **Tämä on se "normi web-sovellus".** |
| `server/` | Express-API. Tarjoilee myös `client/`:n tuotannossa. |
| `shared/` | `schema.ts` — tietokannan rakenne ja validointi, käytössä molemmilla puolilla. |
| `android/` | Capacitor-kuori Androidille. Ei omaa sovelluslogiikkaa. |
| `ios/` | Capacitor-kuori iOS:lle. Ei omaa sovelluslogiikkaa. |
| `e2e/` | Selainajurilla ajettavat tarkistukset. Eivät kuulu sovellukseen. |
| `scripts/` | Apuskriptit: mobiilibuild, indeksimigraatio, kuvakaappaukset. |

---

## client/ — selainsovellus

```
client/src/
  App.tsx            reitit ja pääsynvalvonta (ProtectedRoute, PersonalDataRoute)
  main.tsx           käynnistys
  i18n.ts            KAIKKI tekstit, kuusi kieltä (fi en sv ar ru so)
  index.css          teemavärit
  pages/             29 sivua — yksi tiedosto per näkymä
  components/        6 omaa komponenttia + ui/ (47 kpl shadcn-peruspalikoita)
  contexts/          AuthContext.tsx — kirjautuminen ja istunto
  lib/               apurit, ks. alla
  hooks/             use-mobile (näytön koko), use-toast (ilmoitukset)
  __tests__/         yksikkötestit
```

**`lib/` — nämä kannattaa tuntea:**

| Tiedosto | Tehtävä |
|---|---|
| `api.ts` | Mihin osoitteeseen pyynnöt menevät. Selaimessa suhteellinen polku, puhelimessa `VITE_API_URL`. |
| `queryClient.ts` | Kaikki HTTP-pyynnöt ja virheiden näyttäminen käyttäjälle. |
| `download.ts` | CSV-raporttien lataus (tarvitsee Authorization-otsakkeen). |
| `pushNotifications.ts` | Push-ilmoitusten rekisteröinti ja purku. |
| `dates.ts` | Päivämäärien muotoilu käyttäjän kielellä. |
| `liveUpdater.ts` | Capacitor-päivitykset ilman kauppalatausta. |

**Mitä kukin rooli näkee valikossa** — määritelty tiedostossa
`components/app-sidebar.tsx`, funktiossa `getMenuGroups()`:

| Rooli | Valikon sisältö |
|---|---|
| Huoltaja | Etusivu, Minun lapseni, Ruokalista \| Poissaolot, Lomakkeet, Viestit \| Tiedot ja yksityisyys |
| Henkilökunta | Etusivu, Lapset, Lisää merkintä, Ruokalista \| Poissaolot, Lomakkeet, Viestit \| Käyttäjät, Poistopyynnöt |
| Johtaja | sama kuin henkilökunta + Auditointilokit, Asetukset |
| Pääkäyttäjä | Etusivu, Kunnat, Päiväkodit, Ylläpitäjät \| Tilastot, Auditointilokit, Asetukset |

Kirjautumispolku: `DaycareSelectionPage` → `RoleSelectionPage` → `LoginPage` →
(`ChangePasswordPage`, jos ensimmäinen kirjautuminen).

**Kaksi sivua ei ole valikossa lainkaan:**

- `DocumentsPage` (`/documents`) — sinne pääsee yläpalkin `DocumentsDropdown`-valikosta.
- `TripsPage` (`/trips`) — **tähän ei johda yhtään linkkiä koko sovelluksessa.**
  Sivu on olemassa ja toimii, mutta siihen pääsee vain kirjoittamalla osoitteen
  selaimeen. Ainoa viittaus koko `client/`-kansiossa on reitin määrittely
  `App.tsx`:ssä. Retket-ominaisuus on siis käytännössä piilossa käyttäjiltä.

Valikko päättää vain mitä *näytetään*. Varsinainen pääsynvalvonta on kahdessa
paikassa: `App.tsx`:n `PersonalDataRoute` (19 reittiä henkilötietojen takana) ja
palvelimen `auth.ts`. Valikon piilottama sivu ei siis ole suojattu — se on vain
piilossa.

---

## server/ — API

Rivimäärä kertoo mistä etsiä; kaksi ensimmäistä ovat käytännössä koko sovellus.

| Tiedosto | Riviä | Tehtävä |
|---|---|---|
| `routes.ts` | 3338 | **Kaikki HTTP-päätepisteet.** Etsi tästä `app.get('/api/...` |
| `storage.ts` | 2140 | **Kaikki tietokantakyselyt.** Reitit kutsuvat vain tätä. |
| `menuScraper.ts` | 516 | Ruokalistan haku Aromi-järjestelmästä |
| `seed.ts` | 264 | Demodata. Ilman tätä kirjautumissivu on tyhjä. |
| `index.ts` | 236 | Käynnistys, middleware, ajastetut työt |
| `auth.ts` | 234 | Salasanat, tokenit, rooliluvat |
| `push.ts` | 190 | Ilmoitusten lähetys puhelimiin (FCM) |
| `db.ts` | 182 | Tietokantayhteys, välimuisti, lukot |
| `email.ts` | 117 | Salasanan palautusviestit (SMTP) |
| `vite.ts` | 104 | Tarjoilee `client/`:n — kehityksessä ja tuotannossa eri tavalla |
| `rateLimit.ts` | 90 | Pyyntökatot |
| `cors.ts` | 67 | Mitkä originit saavat kutsua API:a (mobiili tarvitsee tätä) |
| `pagination.ts` | 52 | Listojen rivikatot |
| `csv.ts` | 39 | Vientien solut — estää kaavat Excelissä |
| `errorHandler.ts` | 36 | Käsittelemättömät virheet |

**Sääntö:** reitit eivät koske tietokantaan suoraan. `routes.ts` kutsuu
`storage.ts`:ää, joka tekee kyselyt. Jos etsit "mistä tämä data tulee", polku on
aina sivu → `routes.ts` → `storage.ts` → `shared/schema.ts`.

---

## Testit — kaksi eri lajia

| | Yksikkötestit | e2e |
|---|---|---|
| Missä | `server/__tests__/`, `client/src/__tests__/` | `e2e/` |
| Ajo | `npx vitest run` | `./e2e/run.sh` |
| Tarvitsee | ei mitään | PostgreSQL + Chromium |
| Kesto | sekunteja | kymmeniä minuutteja |
| Kattaa | logiikan: luvat, validointi, CSV, virheet | oikean sovelluksen selaimessa |

`e2e/`-skriptit yksitellen:

| Skripti | Mitä varmistaa |
|---|---|
| `journeys.mjs` | Jokainen rooli kirjautuu ja klikkaa valikon läpi |
| `pages.mjs` | Jokainen sivu jokaisella roolilla |
| `mobile.mjs` | Samat sivut puhelinkoossa (390px), ettei mikään vuoda yli reunan |
| `sidebar.mjs` | Sivupalkki pysyy paikallaan, laatikko sulkeutuu puhelimessa |
| `writes.mjs` | Tallennukset: merkintä, viesti, poissaolo |
| `absences.mjs` | Poissaolojen laskenta ja kaksoisilmoitukset |
| `superadmin.mjs` | Pääkäyttäjä ei näe henkilötietoja |
| `reset.mjs` | Salasanan palautus päästä päähän |
| `export-check.mjs` | Neljä CSV-vientiä latautuvat |
| `export-injection.mjs` | Vienti ei kanna Excel-kaavoja |
| `lib.mjs`, `run.sh` | Yhteiset apurit ja ajuri — eivät ole testejä |

---

## Konfiguraatiot juuressa

| Tiedosto | Mitä ohjaa |
|---|---|
| `package.json` | Komennot (`dev`, `build`, `start`, `build:mobile`) ja riippuvuudet |
| `vite.config.ts` | Selainsovelluksen käännös |
| `capacitor.config.ts` | Puhelinsovellusten asetukset |
| `drizzle.config.ts` | Tietokantamigraatiot |
| `tailwind.config.ts` | Ulkoasun perusasetukset |
| `vitest.config.ts` | Yksikkötestit |
| `docker-compose.yml` | Koko pinon ajo yhdellä komennolla |
| `Dockerfile` | Palvelimen kontti |
| `.env.example` | Kaikki ympäristömuuttujat selityksineen |

---

## Muut dokumentit

| Tiedosto | Mihin |
|---|---|
| `README.md` | Asennus, ajo, ympäristömuuttujat, tietosuoja |
| `MOBILE_RELEASE.md` | **Puhelinsovellusten buildaus ja julkaisu** |
| `iOS_BUILD_GUIDE.md` | Xcoden vaiheet (vaatii Macin) |
| `AUDIT_CHECKLIST.md` | GDPR-materiaali |
| `design_guidelines.md` | Ulkoasun periaatteet |
| `SCREENSHOT_GUIDE.md` | Kauppakuvien ottaminen |
| `e2e/README.md` | e2e-testien ajo |

---

## Mistä etsiä, kun jokin on rikki

| Oire | Katso ensin |
|---|---|
| Sivu näyttää väärää tietoa | `client/src/pages/<Sivu>.tsx`, sitten `server/routes.ts` |
| API palauttaa väärän vastauksen | `server/routes.ts` → `server/storage.ts` |
| Teksti on väärällä kielellä tai puuttuu | `client/src/i18n.ts` |
| Rooli näkee jotain mitä ei pitäisi | `server/auth.ts` (luvat) ja `client/src/App.tsx` (reitit) |
| Puhelinsovellus ei tavoita palvelinta | `client/src/lib/api.ts` ja `server/cors.ts` |
| Ilmoitus ei tule puhelimeen | `client/src/lib/pushNotifications.ts` ja `server/push.ts` |
| Kirjautuminen ei toimi | `client/src/contexts/AuthContext.tsx` ja `server/auth.ts` |
| Vienti aukeaa väärin Excelissä | `server/csv.ts` |
| Buildi kaatuu | `package.json`, `vite.config.ts`, `scripts/build-mobile.mjs` |
