# Rutiini: korjausraportti 15.9.2026 tarkastukseen

**Päivä:** 15.9.2026
**Lähtökohta:** tarkastettu versio `b026e0dc85d813f97fc8f36923b8add705490add`
**Toimeksianto:** korjaa tarkastusraportin löydökset ja raportoi tulos.

## Johtopäätös

**Kaikki tarkastuksen P1-löydökset on korjattu, ja neljä niistä on todennettu
ajamalla sama hyökkäys uudelleen oikeaa PostgreSQL-tietokantaa vasten.** Kaksi
löydöstä on korjattu vain osittain, ja kolme kohtaa on sellaisia joita koodilla ei
voi korjata lainkaan — ne on merkitty erikseen alla, eikä niitä pidä lukea
tehdyiksi.

**Tämä ei kumoa tarkastuksen johtopäätöstä.** Tarkastaja sanoi, ettei versiota
pidä hyväksyä oikeiden lasten tietojen tuotantokäyttöön *tämän tarkastuksen
perusteella*. Se pätee yhä: korjaukset poistavat löydetyt viat, mutta hyväksyntä
edellyttää uutta riippumatonta arviota, rekisterinpitäjän päätöksiä ja testausta
oikeassa ympäristössä. Tämä raportti kuvaa mitä koodissa muuttui — se ei ole
oikeudellinen lausunto eikä turvallisuushyväksyntä.

**Ensin se mikä on tunnustettava.** F01 oli minun aiheuttamani, commitissa
`1f05215`. Kirjoitin myös ne tenanttieristystestit jotka eivät sitä löytäneet,
ja perustelin niiden rakenteen testitiedoston kommentissa. Perustelu oli pätevä,
mutta sillä oli sokea piste jota en nähnyt — siitä tarkemmin kohdassa "Miksi
testit eivät löytäneet tätä".

---

## Korjatut P1-löydökset

### F01: tyhjä lapsen päivityspyyntö palautti toisen päiväkodin lapsen

**Korjattu. Toistettu ennen ja jälkeen oikeaa tietokantaa vasten.**

Syy oli yhdellä rivillä `server/storage.ts`:ssä:

```ts
if (Object.keys(fields).length === 0) return this.getChild(id);
```

`getChild(id)` ei rajaa päiväkotia. Reitti välitti `user.daycareId`:n oikein, mutta
tämä haara ohitti sen.

Korjattu molemmista päistä. Reitti hylkää päivityksen jossa ei ole yhtään kenttää
— päivitys joka ei muuta mitään ei ole luku, ja yhden lapsen GET-reittiä ei ole
olemassa juuri siksi ettei sitä ollut tarkoitus olla. Tallennuskerroksen tyhjä
haara lukee nyt päiväkotirajatusti, kuten kirjoitus sen alapuolella.

**Ennen:**
```
PATCH /api/children/4  {}  →  200
{"id":4,"name":"Ville Mäkelä","birthdate":"2020-11-03","groupId":1,
 "daycareId":2,"allergies":null,"diet":null}
```

**Jälkeen:**
```
PATCH /api/children/4  {}                      →  400  {"error":"No fields to update"}
PATCH /api/children/4  {"allergies":"testi"}   →  404  {"error":"Child not found"}
PATCH /api/children/1  {"allergies":"Pähkinä"} →  200  (oma lapsi, toimii yhä)
```

### F02: uloskirjautuminen jätti edellisen käyttäjän tiedot välimuistiin

**Korjattu. Todennettu koodista, ei ajamalla käyttäjänvaihtoa laitteella.**

`logout` tyhjensi Reactin tilan ja localStoragen mutta ei koskaan React Queryn
välimuistia, ja `staleTime: Infinity` teki tiedoista uudelleenkäytettäviä ilman
uutta hakua. Koko asiakaspuolella ei ollut yhtään `clear()`-, `removeQueries()`-
eikä `cancelQueries()`-kutsua.

Välimuisti tyhjennetään nyt **sekä uloskirjautuessa että sisäänkirjautuessa**.
Uloskirjautumisessa keskeneräiset haut perutaan ensin — muuten kesken jäänyt haku
laskeutuisi välimuistiin sen tyhjentämisen *jälkeen* ja jäisi odottamaan seuraavaa
kirjautujaa.

Sisäänkirjautumisen tyhjennys on tahallinen kaksinkertaisuus: se kattaa myös
tapaukset joissa istunto vaihtuu ilman että `logout` ehtii ajaa.

**Ei tehty:** käyttäjäkohtaisia hakuavaimia ei lisätty. Se olisi vaatinut
muutoksen jokaiseen sivuun, ja välimuistin tyhjennys sulkee reiän kokonaan.
Avainten skooppaus jää syvyyssuojaukseksi myöhemmin.

### F03: lomakkeisiin ja viesteihin saattoi liittää vieraan lapsen

**Korjattu molemmat polut. Viestipolku toistettu ajamalla.**

Lomake joka ei vaadi lapsikontekstia otti `childId`:n rungosta tarkistamatta. Se
pakotetaan nyt tyhjäksi: lomake joka ei kysy lapsesta ei saa kantaa lapsiviitettä.

Viesteissä vain huoltajahaara tarkisti mitään, joten henkilökunta ja johtaja
saattoivat liittää minkä tahansa lapsen. Liitetty lapsi tarkistetaan nyt
**jokaiselta roolilta** päiväkotirajatulla haulla, ennen roolikohtaisia sääntöjä.

Lisättiin `getChildInDaycare(id, daycareId)`, jotta raja on kyselyssä eikä
tarkistuksessa jonka joku muistaa kirjoittaa.

```
POST /api/messages childId=4 (toinen päiväkoti)  →  403  {"error":"Unauthorized"}
POST /api/messages childId=1 (oma)               →  200
```

### F04: lomakkeen päiväkodin saattoi vaihtaa päivityspyynnössä

**Korjattu. Todennettu koodista.**

Reitti välitti `req.body`:n sellaisenaan ja tallennus levitti sen riville,
`daycareId` mukaan lukien. Kolme muutosta:

1. Uusi `updateFormSchema` sallii vain otsikon, kuvauksen, tyypin, kentät,
   aktiivisuuden ja lapsikontekstivaatimuksen. `daycareId` ja `createdById` eivät
   ole muokattavissa, ja `.strict()` hylkää tuntemattomat kentät sen sijaan että
   ohittaisi ne hiljaa.
2. `updateForm` rajaa WHERE-lauseessa päiväkodilla.
3. `getFormSubmissions` rajaa päiväkodilla — vastaukset ovat nimettyjä lapsia
   koskevia, eikä niitä saa hakea pelkällä lomaketunnisteella.

### F05: poistaminen saattoi tuhota osan tiedoista ja epäonnistua

**Korjattu, ja samalla tehtiin tuotepäätös joka on kirjattava näkyviin.**

Kaksi erillistä ongelmaa. `deleteChild` ei käsitellyt kolmea lapseen viittaavaa
taulua (`child_consents`, `form_submissions`, `messages`), `deleteUser` ei
kymmentä. Kumpikaan ei ollut transaktio, joten epäonnistunut poisto jätti
aiemmat vaiheet voimaan pysyvästi.

Molemmat ovat nyt **yhdessä transaktiossa**: joko valmistuu tai ei jätä jälkeä.

**Tuotepäätös, jonka tein ja jonka voit kumota:** henkilökunnan tilin poisto ei
enää hävitä lasten hoitohistoriaa. Aiemmin `deleteUser` poisti jokaisen merkinnän
jonka kyseinen kasvattaja oli kirjoittanut ja jokaisen poissaolon jonka hän oli
kirjannut — ne ovat päiväkodin tietoja lapsesta, eivät työntekijän omia tietoja.
Rivit jaetaan nyt kahteen:

- **Henkilön omat rivit poistetaan:** huoltajasuhteet, ilmoitukset,
  push-tunnisteet, istunnot, poistopyynnöt, retkivastaukset, lomakevastaukset,
  suostumukset ja viestit.
- **Päiväkodin tiedot lapsesta säilyvät, tekijä anonymisoidaan:** merkinnät,
  poissaolot, asiakirjat, lomakkeet, retket, sopimukset, varaukset ja läsnäolot.

Tämä vaati yhdeksän tekijäsarakkeen sallimaan NULLin. Skeemamuutos on additiivinen
(NOT NULL → nullable ei voi epäonnistua olemassa olevalla datalla), mutta se
**vaatii `npm run db:push`-ajon** ennen kuin uusi koodi toimii.

Suostumus poistetaan huoltajan mukana: suostumus on pätevä vain koska tietty
huoltaja antoi sen, joten se ei jää seisomaan ilman antajaansa.

### F06: ruokalistan osoite mahdollisti rajoittamattoman palvelinhaun

**Korjattu. Osoitelogiikalle 13 testiä.**

Uusi `server/urlSafety.ts`. Osoite tarkistetaan **kahdesti**: tallennettaessa,
jotta virhe näkyy lomakkeella, ja haettaessa, koska tallennettu osoite voi osoittaa
eri paikkaan siihen mennessä kun yöajo käyttää sitä.

Vaatimukset: vain `https`, ei tunnuksia osoitteessa, ja **isäntänimi resolvoidaan**
— "localhost" on ilmeinen tapaus, mutta kenen tahansa hallitsema nimi voi osoittaa
osoitteeseen 127.0.0.1 yhtä helposti. Kaikki palautetut osoitteet tarkistetaan, ei
vain ensimmäistä. Hylätään silmukkaosoitteet, kolme yksityistä IPv4-aluetta,
link-local (johon pilvipalvelujen metadata-osoite 169.254.169.254 kuuluu),
CGNAT, multicast, IPv6-vastineet ja IPv6:een upotetut IPv4-osoitteet.

Uudelleenohjaukset ovat tapa kiertää ennen navigointia tehty tarkistus, joten
selaimen **jokainen pyyntö** tarkistetaan erikseen `setRequestInterception`illa.

Samalla poistui kiinteä `/nix/store/...`-polku Chromiumiin, joka ei ole olemassa
Docker-kuvassa eikä millään muulla koneella — scraper ei olisi voinut toimia
missään muualla kuin sen kirjoittajan koneella.

**Jäljelle jää:** selain käynnistyy yhä `--no-sandbox`-lipulla. Sandboxin
palauttaminen vaatii kontin oikeuksien muuttamista, enkä voi todentaa sitä täällä.

### F07: riippuvuusvelka

**Olennaisesti pienennetty mittaamalla, ei arvaamalla.**

Raportin neuvo oli "poista tarpeettomat ajonaikaiset paketit". Johdin
`dist/`-hakemiston staattisesta importtigraafista mitä tuotanto oikeasti tarvitsee:
**15 pakettia 90:stä.** Loput 75 — React, Radix, Capacitor, Playwright,
`@types/*` — käännetään asiakasnippuun buildin aikana eikä niitä ladata ajossa
lainkaan.

| | Ennen | Jälkeen |
|---|---:|---:|
| Tuotantoriippuvuuksia | 90 | **15** |
| Asennettuja paketteja runtime-kuvassa | ~800 | **231** |
| Kriittisiä haavoittuvuuksia (`--omit=dev`) | 5 | **1** |
| Korkeita | 23 | **13** |
| Yhteensä | **41** | **16** |

**Todennettu ajamalla**, ei päättelemällä: `npm ci --omit=dev` onnistuu, ja
`node dist/index.js` käynnistyy ja vastaa `/api/health`-reittiin oikeaa
tietokantaa vasten pelkillä näillä 15 paketilla.

Jäljelle jäävä kriittinen ja useimmat korkeat ovat **puppeteer-ketjussa**
(`basic-ftp`, `extract-zip`, `@puppeteer/browsers`). Puppeteer tarvitaan vain
Aromi-ruokalistojen hakuun. Jos se ominaisuus ei ole käytössä, paketin poistaminen
veisi jäljellä olevan kriittisen — se on tuotepäätös, en tehnyt sitä.

`npm audit fix` ei ollut käytettävissä: se kaatuu npm:n sisäiseen virheeseen
(`Cannot read properties of null (reading 'edgesOut')`). Lukkotiedosto on ennallaan.
Suorien riippuvuuksien päivitykset on tehtävä paketti kerrallaan ja testattava.

---

## Korjatut P2-löydökset

### F08: poistopyynnön hyväksyntä ei suorittanut poistoa

**Korjattu.** Hyväksyntä päivitti vain tilan, käsittelijän ja aikaleiman. Henkilölle
kerrottiin että tiedot poistetaan, ylläpitäjä näki pyynnön hyväksyttynä, eikä mitään
poistettu — eikä mikään näyttänyt ettei sitä ollut tehty.

Hyväksyntä suorittaa nyt poiston. Jos se epäonnistuu, tila jää "approved" ja
vastaus kertoo suoraan ettei poisto valmistunut.

Valmistumista ei voi kirjata itse pyyntöriville, koska poisto vie sen mukanaan —
poistopyyntö on pyytäjän henkilötietoa sekin. Valmistuminen kirjataan
auditointilokiin, jossa tunniste on tiivistetty.

### F09: henkilötietojen vienti ei kattanut kaikkia tietoryhmiä

**Korjattu.** Viennistä puuttui viisi ryhmää, kaikki lisätty sen kirjoittamisen
jälkeen eikä yhtäkään lisätty vientiin: suostumukset, hoitoaikavaraukset,
viikkomallit, toteutuneet läsnäolot ja sopimukset. Kaikki viisi mukana, samalla
säännöllä kuin muutkin — rajattu huoltajan lapsiin, ilman sivutuskattoja.

### F10: tietosuojaselosteen suora osoite palautti 500

**Korjattu. Toistettu ajamalla.** Reitti etsi kolmesta paikasta tiedostoa
`privacy-policy.html`, jota ei ole lähteissä eikä buildissa. React-sivu on ollut
olemassa koko ajan ja on julkinen reitti. Poistin turhan reitin, jolloin SPA
tarjoilee sivun.

```
ennen:    GET /privacy-policy  →  500  "Privacy policy not found"
jälkeen:  GET /privacy-policy  →  200  (React renderöi selosteen)
```

### F11: pakollinen salasananvaihto ei rajoittanut palvelinta

**Korjattu. Toistettu ajamalla.** `passwordNeedsReset` ohjasi käyttöliittymää eikä
mitään muuta, joten kuka tahansa joka ohitti lomakkeen — tai kutsui API:a suoraan —
sai täydet oikeudet salasanalla jonka ylläpitäjä oli antanut. Juuri se tunnus jonka
pakotettu vaihto on tarkoitettu poistamaan käytöstä.

Väliaikaisella salasanalla avattu istunto pääsee nyt vain vaihtamaan salasanan ja
kirjautumaan ulos.

```
ennen:    GET /api/children  →  200, 3 lasta
jälkeen:  GET /api/children  →  403  {"error":"Password change required"}
          POST /api/auth/change-password  →  200  (sallittu)
```

Samalla korjattiin raportin toinen huomio: palautusreitti tarkisti vain kahdeksan
merkin pituuden, vaikka muualla luvataan vahvempi käytäntö. Nyt se käyttää samaa
sääntöä. Skeema oli jo olemassa `shared/schema.ts`:ssä — reitti ei vain käyttänyt
sitä.

### F12: push-ilmoitukset kantoivat lapsen nimen ja arkaluonteista sisältöä

**Korjattu.** Push kulkee Googlen palvelun kautta ja laskeutuu lukitusnäytölle,
jossa sen lukee se jolla puhelin on kädessä ja se joka seisoo vieressä.

| | Ennen | Jälkeen |
|---|---|---|
| Merkintä | lapsen nimi + merkinnän sisältö | "Uusi merkintä päiväkodista" |
| Poissaolo | lapsen nimi + tyyppi (esim. sairaus) | "Uusi poissaoloilmoitus" |
| Viesti | lähettäjän nimi + 120 merkkiä | "Uusi viesti" |

Data-osa kuljettaa yhä tyypin ja tunnisteen, joten napautus vie oikeaan näkymään.
Yksityiskohdat ovat siellä, tunnistautumisen takana.

Retki-ilmoitus jätettiin ennalleen: retken nimi, päivä ja paikka eivät ole
henkilötietoa lapsesta.

### F13: iOS-push käytti väärää tunnistetyyppiä

**Osittain korjattu.** En voi tehdä Xcode-työtä enkä todentaa laitetoimitusta
täällä, joten en väitä iOS-pushin toimivan.

Mitä tein: alusta **tallennetaan jo** tietokantaan, palvelin ei vain haarautunut sen
perusteella. Nyt iOS-tunnisteita ei lähetetä FCM:lle, ja syy kirjataan lokiin.
APNs-tunnisteelle ei voi toimittaa FCM:n kautta — jokainen iOS-laite epäonnistui
hiljaa, mikä näytti täältä katsottuna toimivalta ominaisuudelta.

**Jäljellä:** Firebase Messaging iOS-projektiin, jotta se antaa FCM-tunnisteen, tai
erillinen APNs-lähetys. Kumpikaan ei ole tehty.

### F14: vaikutustenarviointi ei ollut luotettava hyväksyntänäyttö

**Asiavirheet korjattu, hyväksyntää ei voi korjata koodilla.**

- Viittaus lakiin **36/1973** vaihdettu varhaiskasvatuslakiin **540/2018**, joka
  kumosi sen, ja kirjattu että säilytysseuraukset on tarkistettava voimassa olevaa
  lakia vasten.
- Säilytystaulukko korjattu vastaamaan koodin oletuksia. **Neljä riviä oli
  väärin:** viestit ja retket ilmoitettiin 24 kuukaudeksi, ne ovat 12; poissaolot
  ilmoitettiin 12:ksi, ne ovat 24; hoitoaikoja ei ollut listattu lainkaan.
- Lisätty näkyvä varoitus: **lapsen perustiedoilla, suostumuksilla,
  lomakevastauksilla ja sopimuksilla ei ole automaattista elinkaaren päättymistä
  lainkaan.** "Hoitosuhde + 5 vuotta" kuvasi aikomusta, ei mekanismia.
- Asiakirjan alkuun merkintä siitä että se on **luonnos jota ei ole hyväksytty**:
  rekisterinpitäjä on yhä paikanpitäjä `[Municipality Name]`, hyväksyntäosio on
  tyhjä, eikä riskiarvio heijasta tämän tarkastuksen löydöksiä.

---

## Muut tekniset huomiot

### Samanaikaiset sisäänkirjaukset

**Korjattu tietokantatasolla.** Sovelluksen tarkistus ja rivin luonti ovat kaksi
eri lausetta: kaksi puhelinta oven suussa samalla hetkellä eivät kumpikaan löydä
mitään ja molemmat lisäävät, jolloin avoimia jaksoja on kaksi ja päivän tunnit
kaksinkertaiset.

Lisätty osittainen uniikki-indeksi: enintään yksi avoin läsnäolo lasta kohti.
Sovelluksen tarkistus jää antamaan ystävällisen vastauksen, mutta takuu on nyt
siellä missä kilpailutilanne ei pääse sen ohi. Reitti käsittelee törmäyksen
palauttamalla olemassa olevan jakson — se ei ole virhe jota kenellekään kannattaa
näyttää.

### Retkilistan rajaus

**Korjattu.** Haku otti 200 vanhinta retkeä ja suodatti menneet pois vasta
JavaScriptissä, joten kun vanhoja retkiä oli tarpeeksi, tulevat jäivät sivun
ulkopuolelle ja lista tuli tyhjänä — sitä pahemmin mitä kauemmin päiväkoti oli
tuotetta käyttänyt. Päivämäärärajaus on nyt kyselyssä.

### Zoomauksen esto

**Korjattu.** `client/index.html` rajoitti zoomausta arvolla `maximum-scale=1`.
Poistettu.

**Huom:** tämä ei tee sovelluksesta saavutettavaa. Kattavaa saavutettavuus- tai
ruudunlukija-auditointia ei ole tehty, eikä saavutettavuusselostetta ole.

### Chromiumin polku

**Korjattu** osana F06:ta.

### Ei korjattu

- **`localStorage`-istunnot mobiilissa.** Turvallinen tunnistevarasto,
  varmuuskopiointirajaukset ja jaettujen laitteiden käytännöt on arvioitava; en
  tehnyt muutosta.
- **Nipun koko.** Asiakasnippu on yhä noin 1 Mt. Sivukohtainen lataus on
  jatkokehityskohde, ei tietoturvakorjaus.

---

## Mitä koodilla ei voi korjata

Nämä eivät ole tekemättä unohduksesta. Ne eivät ole koodikysymyksiä, eikä niitä
pidä lukea korjatuiksi.

| Asia | Kenelle kuuluu |
|---|---|
| Rekisterinpitäjän ja käsittelijän roolit, yhteystiedot | Rekisterinpitäjä ja tietosuoja-asiantuntija |
| Tarkoituskohtaiset käsittelyperusteet, 9 artiklan peruste terveystiedoille | Sama |
| Allekirjoitetut käsittely- ja alikäsittelijäsopimukset | Sama |
| Poikkeamien käsittelyprosessi ja vastuuhenkilöt | Sama |
| Vaikutustenarvioinnin hyväksyntä ja jäännösriskin arviointi | Sama |
| Saavutettavuusarvio, seloste ja palautekanava | Sama |
| Säilytyssuunnitelma asiakirjatyypeittäin | Sama |
| Julkaistujen salaisuuksien vaihtaminen, jos repositorio on ollut julkinen | Omistaja |

---

## Verifiointi

| Tarkistus | Tulos |
|---|---|
| TypeScript, `tsc` | Puhdas, EXIT=0 |
| Vitest | **398/398 läpi, 19 tiedostoa** (ennen 385/18) |
| Tuotantobuild | Onnistuu |
| `npm ci --omit=dev` | Onnistuu, 231 pakettia |
| Kontin käynnistys | `node dist/index.js` käynnistyy ja `/api/health` → 200 `"database":"connected"` |
| F01 uudelleen ajettuna | Tyhjä → 400, vieras lapsi → 404, oma lapsi → 200 |
| F03b uudelleen ajettuna | Vieras lapsi → 403, oma → 200 |
| F10 uudelleen ajettuna | 500 → 200 |
| F11 uudelleen ajettuna | 200 → 403, vaihtoreitti → 200 |
| Riippuvuustarkistus | Tuotanto 41 → 16, kriittiset 5 → 1 |

Uudet testit: 13 kappaletta `server/__tests__/urlSafety.test.ts`:ssä, jotka
kohdistuvat siihen mitä **pitää hylätä** — silmukkaosoitteet, yksityiset alueet,
pilvimetadata, IPv6:een upotetut IPv4-osoitteet ja nimet jotka resolvoituvat
sisäverkkoon.

Testiympäristö: oikea PostgreSQL (pglite TCP:n yli), skeema `drizzle-kit push`illa,
kaksi päiväkotia `server/seed.ts`:stä. Ei tuotantotietoja.

**Ei ajettu:** Docker-buildia (daemon ei käytettävissä), fyysisen laitteen
push-toimitusta, iOS-käännöstä, selainpohjaista käyttäjänvaihtotestiä, kattavaa
saavutettavuusauditointia, ruokalistascraperia oikeaa Aromi-sivustoa vasten.

---

## Miksi testit eivät löytäneet tätä

Tämä on raportin tärkein kohta, koska se koskee kaikkia tulevia löydöksiä.

Rakensin tenanttieristystestit ajamaan oikeita reittejä **sallivaa
valetallennuskerrosta** vasten, ja perustelin sen testitiedoston kommentissa: jos
vale pakottaisi rajaukset, se tekisi testien työn niiden puolesta ja jokainen testi
menisi läpi todistamatta mitään.

Perustelu on yhä pätevä. Sen sokea piste on se, että testi todistaa **reitin
välittävän** `daycareId`:n — ei **tallennuskerroksen käyttävän** sitä. F01 asui
täsmälleen siinä raossa: reitti teki kaiken oikein, ja yksi haara tallennuksessa
ohitti sen.

Tarkastaja ajoi lapsen ja lomakkeen päivitykset **oikeaa tallennuslogiikkaa**
vasten, ja siksi hän löysi molemmat.

**Tästä seuraa konkreettinen tehtävä, jota ei ole vielä tehty:**
eristystestit oikeaa PostgreSQL:ää ja oikeaa tallennuskerrosta vasten, ei valetta.
Ilman sitä sama virheluokka palaa. Ajoin tämän kierroksen todennukset käsin; ne
eivät ole automaattisia testejä.

---

## Suositeltu etenemisjärjestys

1. **`npm run db:push` ennen käyttöönottoa.** Yhdeksän tekijäsaraketta sallii nyt
   NULLin ja läsnäoloihin tuli uniikki-indeksi. Vanha kanta ei toimi uuden koodin
   kanssa ilman tätä. Ota varmuuskopio ensin.
2. **Kirjoita tenanttieristystestit oikeaa kantaa vasten.** Tämä on ainoa kohta
   joka estää saman virheluokan palaamisen.
3. **Päätä puppeteerin kohtalo.** Jos Aromi-haku ei ole käytössä, paketin
   poistaminen vie jäljellä olevan kriittisen haavoittuvuuden.
4. **Vahvista poistojen semantiikka.** Tein tuotepäätöksen siitä mitä säilyy ja
   mitä anonymisoidaan. Se on perusteltu mutta se on sinun päätöksesi.
5. **Uusi riippumaton tarkastus korjatusta versiosta.** Tämä raportti kertoo mitä
   minä muutin ja mitä minä todensin. Sama henkilö ei voi antaa itselleen
   hyväksyntää.
6. **Rekisterinpitäjän ja tietosuoja-asiantuntijan työ** yllä olevasta taulukosta.
   Se ei riipu koodista eikä etene ilman erillistä päätöstä.

**Tämä raportti kuvaa tehdyt muutokset. Se ei ole turvallisuushyväksyntä eikä
oikeudellinen lausunto.**
