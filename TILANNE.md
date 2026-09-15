# Tilanne

Päivitetty 15.9.2026. Tämä tiedosto kertoo mikä on valmista, mikä ei ole, mikä on
rikki ja mitä pitää tehdä seuraavaksi.

Ulkopuolinen koodi-, tietoturva- ja tietosuojatarkastus tehtiin 15.9.2026. Sen
löydökset on korjattu; korjausraportti on `TARKASTUS-KORJAUKSET.md`.

Se on kirjoitettu niin että sen voi antaa ostajalle tai käyttöönottavalle
päiväkodille sellaisenaan. Siksi siinä ei ole mitään merkitty valmiiksi ennen kuin
se on ajettu, eikä mitään väitetä toimivaksi tuotannossa ennen kuin se on ollut
siellä.

**Lyhyt versio:** sovellus on toiminnallisesti laaja ja testattu paikallisesti,
mutta **sitä ei ole koskaan ajettu tuotannossa.** Asiakkaita on nolla. Julkaisu
Railwaylle on kesken eikä ole vielä onnistunut kertaakaan.

---

## 1. Mitä on valmiina

### Mitat

| | |
|---|---|
| Koodia (server + shared + client) | 35 481 riviä |
| Tietokantatauluja | 26 |
| API-päätepisteitä | 107 |
| Sivuja käyttöliittymässä | 31 |
| Kieliä | 6 — suomi, ruotsi, englanti, arabia (RTL), venäjä, somali |
| Yksikkö- ja integraatiotestejä | **385**, 18 tiedostossa |
| Selainskriptejä (e2e) | 12 |

### Ominaisuudet

**Perusta.** Moniasiakkuus päiväkodeittain (`daycareId` skooppaa jokaisen kyselyn),
roolipohjaiset oikeudet neljälle roolille, kuuden kielen käännökset, mobiilikuoret
Capacitorilla iOS:lle ja Androidille, Docker-asennus.

**Päivittäinen käyttö.** Lasten merkinnät (ruoka, uni, leikki, tapahtuma),
poissaoloilmoitukset, viestit henkilökunnan ja huoltajien välillä, ruokalista,
lomakkeet ja suostumukset, asiakirjat, retket, CSV-raportit.

**Hoitoaikavaraukset.** Viikkopohja, varausten lukitus päiväkodin asettamaan
takarajaan, sisään- ja uloskirjaus, varatun ja toteutuneen vertailu, kuukauden
kertymä sopimustunteja vastaan. **Oletuksena pois päältä** jokaisella päiväkodilla
(`reservationsEnabled = false`), joten olemassa oleva asennus käyttäytyy kuten ennen.

**Allergiat ja ruokavalio.** Kaksi erillistä kenttää: allergia on turvallisuustieto
ja näytetään varoitustyylillä, ruokavalio on ruokalistavalinta. Ruokavalioon
kirjataan mitä ei saa tarjota, ei koskaan miksi — "ei sianlihaa" on keittiön
tarvitsema tieto, "muslimi" olisi GDPR:n 9 artiklan erityinen henkilötietoryhmä.

**Tietosuoja.** Pääkäyttäjän eristys henkilötiedoista, auditointiloki,
säilytysaikojen automaattinen toteutus yöllisellä työllä, GDPR-vienti ja
poistopyynnöt, DPIA-materiaali (`docs/DPIA.md`).

Tarkasti sanottuna, koska tämä luetaan tietosuojaselosteen rinnalla: pääkäyttäjä
**näkee** kunnat, päiväkodit, lukumäärät päiväkodeittain, auditointilokin rivit
ilman `metadata`-kenttää, sekä **päiväkodinjohtajien nimet ja sähköpostiosoitteet**,
koska hän luo ja poistaa ne tunnukset. Hän **ei näe** yhdenkään lapsen nimeä,
syntymäaikaa, allergioita, ruokavaliota eikä ryhmää, ei merkintöjä, poissaoloja,
viestejä, asiakirjoja, lomakkeita, retkiä, suostumuksia, hoitoaikavarauksia eikä
toteutuneita läsnäoloja — eikä huoltajien tai henkilökunnan nimiä tai
yhteystietoja. Kirjautumisen IP-osoite tallentuu auditointilokiin.

### Mikä on verifioitu ajamalla

Nämä on todennettu suorittamalla, ei lukemalla:

| Mitä | Miten |
|---|---|
| 385 yksikkötestiä | `npx vitest run` jokaisella muutoksella |
| Typecheck ja tuotantobuild | `tsc`, `vite build && esbuild` |
| Tenanttieristys | HTTP-tason hyökkäystestit oikeita reittejä vasten, varmistettu kaatumaan kun suojaus poistetaan. **Rajaus: testit ajavat reittejä sallivaa valetallennuskerrosta vasten, joten ne todistavat että reitti välittää `daycareId`:n — eivät että tallennuskerros käyttää sitä.** Ulkopuolinen tarkastus 15.9.2026 löysi tästä raosta todellisen vuodon (F01), joka on korjattu. |
| Käännösten kattavuus | Testi lukee komponenttien käyttämät avaimet ja kaatuu puuttuviin; varmistettu kaatumaan |
| RTL-suunnan alustus | Testi tuo `i18n.ts`:n `lang="en"` -elementillä ja vaatii `fi`; varmistettu kaatumaan |
| Virheraportoinnin puhdistus | Testit syöttävät aitoa henkilötietoa muistuttavaa dataa ja vaativat ettei se selviä payloadiin |
| Demoseed | **Ajettu oikeaa PostgreSQL:ää vasten:** skeema pushattu, seed ajettu, rivimäärät luettu takaisin, palvelin käynnistetty sitä kantaa vasten ja kaikki kolme roolia kirjautuivat sisään (HTTP 200) |
| Tuotantobundlen käynnistys | `node dist/index.js` ajettu `--omit=dev`-riippuvuuksilla; `GET /` palautti 200 |
| Selainajot | 12 skriptiä: jokaisen roolin sivut, kirjoitusoperaatiot, mobiilileveys 390 px, vientien lataus |
| CI | Vihreä jokaisesta commitista; ajaa myös skeeman oikeaa PostgreSQL 16:ta vasten ja kääntää Android-APK:n |

---

## 2. Mitä ei ole

### Ei ole koskaan ajettu tuotannossa

**Asiakkaita: nolla. Tuotantoajoja: nolla.** Kaikki yllä oleva on todennettu
paikallisesti ja CI:ssä. Mikään siitä ei ole ollut oikean päiväkodin käytössä
yhtenäkään päivänä.

### Tuotantovalmiuden vaiheet joita ei ole tehty

Kuudesta suunnitellusta vaiheesta **neljä on kokonaan tekemättä**, koska ne
edellyttävät olemassa olevaa palvelinta:

| Vaihe | Tila |
|---|---|
| 1. Varmuuskopiot ja palautus | **Ei tehty.** Ei varmuuskopiointia, ei palautustestiä, ei todistetta että kanta on palautettavissa. |
| 2. Virheraportointi | **Koodi valmis, ei käyttöönotettu.** `server/errorReporting.ts` toimii ja on testattu, mutta `SENTRY_DSN` on asettamatta eikä yhtään hälytystä ole koskaan saapunut perille. |
| 3. Staging-ympäristö | **Ei ole.** Ei erillistä testiympäristöä. |
| 4. Rollback-menettely | **Ei ole.** Ei kirjattua tapaa palata edelliseen versioon. |
| 5. Monitorointi | **Ei ole.** Ei käytettävyysvalvontaa, ei hälytyksiä. |
| 6. Tenanttieristyksen todennus | **Tehty**, mutta vain muistinvaraista testikantaa vasten. Ajo oikeaa PostgreSQL:ää vasten stagingissa on tekemättä. |

**`RUNBOOK.md`:tä ei ole.** Ei kirjattuja ohjeita varmuuskopiointiin, palautukseen
eikä rollbackiin.

### Migraatiojärjestelmää ei ole

Ainoa työkalu on `drizzle-kit push`, joka vertaa skeemaa kantaan ja soveltaa erot
suoraan. Ei versiohistoriaa, ei etukäteen katselmoitavaa SQL:ää, ei rollbackia. Jos
se päättää pudottaa sarakkeen, se pudottaa sen.

### Puuttuvat ominaisuudet

- **Varda-integraatio** — ei aloitettu
- **Suomi.fi-tunnistautuminen** — ei aloitettu
- **Asiakasmaksut ja laskutus** — ei aloitettu; hoitoaikojen kertymä lasketaan mutta hintaa ei
- **Push-ilmoitusten käännökset** — sovelluksen sisäiset ilmoitukset ovat lukijan kielellä, mutta puhelimeen menevä push lähetetään kääntämättömänä raakadatana
- **Perheen kielen tallennus** — kuuden kielen tuki on pelkkä käyttöliittymän kielivalinta selaimen localStoragessa. Lapsi- tai perhetauluissa ei ole kielikenttää, henkilökunta ei voi asettaa perheen kieltä, eikä valinta seuraa laitteesta toiseen.
- **Sähköpostien monikielisyys** — ainoa lähetettävä sähköposti (salasanan palautus) on kiinteästi suomi + englanti

### Kilpailutuskelpoisuus

Tämä ei läpäise kunnan kilpailutuksen pakollisia vaatimuksia sellaisenaan. Ilman
Vardaa ja Suomi.fi-tunnistautumista tarjous hylätään ennen kuin tuotetta ehditään
arvioida. Yksityiselle päiväkodille sovellus toimii sellaisenaan.

**Vaatimustenmukaisuutta ei ole todennettu.** GDPR, Suomen laki, WCAG 2.2 ja
hankintavaatimukset edellyttävät asiantuntijan erillistä arviointia. Koodi antaa
teknisen pohjan, ei todistusta.

---

## 3. Tiedossa olevat viat

Nämä on löydetty ja todennettu, mutta **ei korjattu**.

### `server/seed.ts` ajaa myös tuotannossa

Skripti luo demotilit salasanalla `password123` eikä siinä ole mitään
`NODE_ENV`-tarkistusta. Jos sen ajaa vahingossa tuotantokantaa vasten, tuotantoon
ilmestyy heikoilla salasanoilla varustettuja tilejä.

Uudempi `server/seedDemo.ts` on turvallisempi — se kieltäytyy ajamasta toista
kertaa — mutta sekään ei tarkista ympäristöä.

### Sivupalkin eväste kirjoitetaan mutta ei lueta

`client/src/components/ui/sidebar.tsx:86` kirjoittaa auki/kiinni-tilan
`sidebar_state`-evästeeseen joka kerta. **Mikään koko koodipohjassa ei lue sitä.**
`SidebarProvider` lähtee `defaultOpen`-propista, joka on `true` eikä `App.tsx` ohita
sitä. Sivupalkki palautuu siis aina auki riippumatta siitä miten käyttäjä sen jätti.

Syy: komponentti on alun perin Next.js:lle, jossa eväste luetaan
palvelinrenderöinnissä. Täällä ei ole palvelinrenderöintiä.

Korjaamatta, koska tähän liittyy tuotepäätös: pitäisikö kiinni taitetun sivupalkin
todella pysyä kiinni seuraavalla käynnillä?

### Dockerfilen kommentti on virheellinen

Rivi 36 väittää että `npm run db:push` voidaan ajaa kontin sisältä. Se ei ole
mahdollista: runtime-image rakennetaan `npm ci --omit=dev` -komennolla, ja
`drizzle-kit` sekä `tsx` ovat devDependencies. Kumpikaan ei ole imagessa.
Tarkistettu. Migraatiot ja seed on ajettava koneelta jolla on täydet riippuvuudet.

### `/trips`-sivuun ei johda yhtään linkkiä

Reitti on `App.tsx`:ssä ja sivu toimii, mutta mikään navigaatio ei vie sinne.
Retket ovat käytännössä piilossa; niihin pääsee vain kirjoittamalla osoitteen.

### Henkilökunnan rajaus on epäjohdonmukainen

Henkilökunta näkee koko päiväkodin lapsilistan ja saa muokata kaikkien allergioita,
mutta merkintöihin pääsee vain omien ryhmiensä osalta. Allergiat pidettiin
päiväkotilaajuisina tarkoituksella — sijainen ruokailussa tarvitsee tiedon — mutta
valinta on syytä tehdä tietoisesti eikä ajautua siihen.

### Push-ilmoitukset menevät kääntämättöminä

Sovelluksen sisäiset ilmoitukset tallennetaan käännösavaimena ja käännetään
lukijan kielellä. Puhelimeen menevä push lähetetään raakana: poissaoloilmoituksen
tyyppi näkyy koodiarvona, ei käännettynä tekstinä.

### Arabian RTL toimii nyt, mutta oli rikki 7.9.2026 asti

Korjattu commitissa `86bd5d2`. Mainittu tässä siksi, että se oli kuukausia
"valmis" ominaisuus joka ei toiminut sivun uudelleenlatauksen jälkeen: suunta
asetettiin vain kielivalikkoa klikattaessa, joten tallennettu arabia palasi
LTR-asettelussa. Samalla paljastui että `<html lang>` ei asettunut koskaan —
jokainen sivu ilmoitti ruudunlukijalle olevansa englantia.

Hyvä muistutus siitä, että kääntäminen ja testaaminen ovat eri asioita.

---

## 4. Julkaisun tila

### Railway

**Mitään ei ole vielä onnistuneesti julkaistu.** Deploy on kaatunut joka kerta.

Mitä on tehty:

1. **Ensimmäinen este löydetty ja korjattu.** `npm ci --omit=dev` kaatui
   virheeseen `Expected "0.27.0" but got "0.25.12"`. Syy: `vitest` ja
   `tailwindcss-animate` olivat `dependencies`-listassa ja vetivät `tsx`:n
   tuotantopuuhun, jolloin lockfilen esbuild-merkinnät menivät ristiin. Korjattu
   commitissa `c68db74`, toistettu ja verifioitu paikallisesti.

2. **Toinen este löydetty ja korjattu.** Kontti ei käynnistynyt:
   `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`. Syy: `dist/index.js` sisälsi
   staattisen Vite-importin. Korjattu commitissa `76477aa` erottamalla
   `server/static.ts` ja lisäämällä `--splitting`.

**Mikä estää sen toimimisen nyt:**

> **Korjaukset ovat työhaarassa `claude/new-session-0c7puo`, eivät `main`-haarassa.**
> `main` on 15 committia jäljessä ja sen viimeisin commit on `f5ce7ae` 29.8.2026.
> Siellä `vitest` on yhä `dependencies`-listassa eikä build-skriptissä ole
> `--splitting`, joten jos Railway deployaa mainista, se kaatuu edelleen
> täsmälleen ensimmäiseen esbuild-virheeseen.

**Docker-imagea ei ole koskaan rakennettu.** Kehitysympäristössä ei ole
Docker-daemonia. Runtime-vaihe on toistettu käsin — sama `npm ci --omit=dev`,
samat kopioidut polut, sama käynnistyskomento — ja se toimii, mutta se ei ole
`docker build`.

### Mitä ympäristömuuttujia tarvitaan

Pakolliset, ilman näitä palvelin ei käynnisty:

| Muuttuja | Kuka asettaa |
|---|---|
| `DATABASE_URL` | Railway antaa automaattisesti jos Postgres on samassa projektissa |
| `JWT_SECRET` | **Sinä.** `openssl rand -base64 48` |
| `SMTP_HOST` | **Sinä** |
| `NODE_ENV=production` | Dockerfile asettaa jo |

`PORT` tulee Railwaylta automaattisesti. `APP_URL` pitää asettaa itse, muuten
salasanan palautuslinkki osoittaa väärään paikkaan.

### Demotunnukset

`npx tsx server/seedDemo.ts` luo Demopäiväkodin (koodi `demo`): 2 ryhmää, 40 lasta,
34 huoltajaa, viikon merkinnät, ruokalistan.

```
Johtaja:     johtaja@demopaivakoti.fi      / Demo2026!
Kasvattaja:  kasvattaja@demopaivakoti.fi   / Demo2026!
Huoltaja:    huoltaja@esimerkki.invalid    / Demo2026!
```

Kaikki tiedot keksittyjä. Huoltajaosoitteet ovat `.invalid`-päätteisiä, jotka eivät
voi resolvoitua, joten demo ei voi lähettää postia kenellekään oikealle.

---

## 5. Mitä seuraavaksi, järjestyksessä

### Jotta julkaisu ylipäätään toimii

1. **Yhdistä työhaara mainiin.** `claude/new-session-0c7puo` → `main`, puhdas
   fast-forward 15 commitin verran, ei konflikteja. Ilman tätä mikään alla oleva ei
   auta.
2. **Aseta ympäristömuuttujat Railwayssa** — `JWT_SECRET`, `SMTP_HOST`, `APP_URL`.
3. **Aja skeema kantaan omalta koneeltasi:** `railway run npm run db:push`. Ota
   varmuuskopio ensin — `db:push` voi pudottaa sarakkeita eikä kysy.
4. **Deployaa ja katso käynnistyykö kontti.** Tämä on ensimmäinen kerta kun se
   tapahtuu oikeasti.
5. **Aja demoseed** kun kontti on pystyssä: `npx tsx server/seedDemo.ts`.

### Ennen kuin kukaan oikea käyttäjä koskee tähän

6. **Varmuuskopiot ja palautustesti.** Palauta varmuuskopio kertaalleen ja todista
   että se toimii. Ilman tätä ensimmäinen tietokantavirhe on lopullinen.
7. **`RUNBOOK.md`** — varmuuskopiointi, palautus, rollback, askel askeleelta.
8. **Sentry käyttöön** — luo tili EU-alueelle, aseta `SENTRY_DSN`, ja **varmista
   kertaalleen että hälytys oikeasti saapuu** `ERROR_REPORTING_TEST_ROUTE`-reitillä.
   Sammuta reitti sen jälkeen.
9. **Monitorointi** — käytettävyysvalvonta `/api/health`-reitille.
10. **Staging-ympäristö** ja tenanttieristystestit oikeaa PostgreSQL:ää vasten.

### Ennen myyntiä tai esittelyä

11. **Päätä sivupalkin ja `/trips`:n kohtalo** — molemmat ovat tuotepäätöksiä.
12. **Korjaa `seed.ts`:n tuotantosuojaus** tai poista skripti julkaisusta.
13. **Tietosuoja-asiantuntijan katselmointi** ennen kuin mitään väitetään
    GDPR-yhteensopivaksi ulospäin.

### Jos tuote viedään kuntamarkkinalle

Järjestyksessä: Varda-integraatio, Suomi.fi-tunnistautuminen, asiakasmaksut.
Näiden kokoluokka on kuukausia, ei päiviä.

---

## Historia

Rutiini on kehitetty noin yhdeksän kuukauden ajan vuoden 2025 lopulta alkaen, alun
perin Replit-alustalla. Koodikanta siirrettiin Gitiin elokuussa 2026, joten tämän
repositorion historia alkaa siirrosta eikä kehityksen alusta. Kehityksen aikana
pidetty `replit.md` on säilynyt git-historiassa ja sisältää päivättyjä merkintöjä
joulukuulta 2025.
