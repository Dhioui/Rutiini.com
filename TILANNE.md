# Tilanne — mihin tämä on, ja missä se on

Tämä tiedosto vastaa kolmeen kysymykseen: **mihin sovellus on olemassa, mitä se
tekee, ja mitä se ei tee.** Asennusohjeet ovat `README.md`:ssä ja koodin sijainnit
`PROJEKTIN_RAKENNE.md`:ssä.

Se kolmas kysymys on tärkein. Se on ainoa jonka sekä ostaja että käyttöönottava
päiväkoti kysyy ensimmäisenä, ja siihen on helpompi vastata etukäteen kirjoitetulla
listalla kuin puhelimessa.

---

## Mihin tämä on

Päiväkodin arki kulkee tällä hetkellä reissuvihkossa, WhatsApp-ryhmässä ja
käytäväkeskusteluissa. Rutiini kokoaa sen yhteen paikkaan: mitä lapselle kuuluu
tänään, milloin hän on poissa, mitä ruokaa on, mitä henkilökunnalle pitää sanoa.

Kaksi asiaa erottaa sen siitä mitä markkinalla on:

**Kuusi kieltä.** Suomi, ruotsi, englanti, arabia, venäjä ja somali, arabialle
RTL-tuki. Isoissa kaupungeissa vieraskielisten perheiden osuus varhaiskasvatuksessa
on merkittävä, ja huoltajaviestintä on juuri se kohta jossa yhteinen kieli loppuu
kesken.

**Ylläpitäjä ei näe lasten eikä huoltajien tietoja.** Tämä ei ole lupaus vaan
rakenne: pääkäyttäjä saa 403:n jokaiselta lapsen tai huoltajan tietoja
käsittelevältä reitiltä, ja yritys kirjautuu auditointilokiin. Useimmissa
järjestelmissä toimittajan pääkäyttäjä voi teknisesti nähdä kaiken, ja asia
hoidetaan sopimuspykälällä.

Sanottuna tarkasti, koska tämä lause luetaan tietosuojaselosteen rinnalla:
pääkäyttäjä **näkee** kunnat, päiväkodit, lukumäärät päiväkodeittain,
auditointilokin rivit ilman `metadata`-kenttää ja tekijän tunnistetta, sekä
**päiväkodinjohtajien nimet ja sähköpostiosoitteet**, koska hän luo ja poistaa ne
tunnukset. Hän **ei näe** yhdenkään lapsen nimeä, syntymäaikaa, allergioita,
ruokavaliota eikä ryhmää, ei päivän merkintöjä, poissaoloja, viestejä,
asiakirjoja, lomakkeita, retkiä, suostumuksia, hoitoaikavarauksia eikä
toteutuneita läsnäoloja — eikä huoltajien tai henkilökunnan nimiä tai
yhteystietoja.

---

## Kenelle

| Rooli | Mitä näkee |
|---|---|
| **Huoltaja** | Oman lapsensa päivän merkinnät, poissaoloilmoitus, viestit, ruokalista, lomakkeet, omat tiedot ja niiden poisto |
| **Henkilökunta** | Oman päiväkodin lapset, merkintöjen kirjaus, poissaolot, viestit, allergiat ja ruokavaliot |
| **Johtaja** | Kaikki edellinen sekä käyttäjienhallinta, CSV-raportit, auditointiloki, asetukset |
| **Pääkäyttäjä** | Kunnat, päiväkodit, anonymisoidut lukumäärät ja päiväkodinjohtajien tunnukset (nimi ja sähköposti). **Ei lasten eikä huoltajien tietoja.** |

Lapsilla ei ole tunnuksia eivätkä he kirjaudu sisään. He ovat vain tietueita, ja
suostumuksen antaa aina huoltaja.

---

## Mitä sovellus tekee

- **Päivän merkinnät** — unet, ruokailut, leikit, mieliala; merkintätyypit ovat
  vapaasti määriteltäviä eivätkä lukittuja tietokantaan
- **Poissaolot** — huoltaja ilmoittaa muutamalla napautuksella; sairaus,
  myöhästyminen ja aikainen haku erikseen
- **Hoitoaikavaraukset** — huoltaja varaa ajat viikkopohjalla, varaukset
  lukkiutuvat ennen viikkoa; henkilökunta kirjaa tulon ja lähdön ovella, ja
  varattua verrataan toteutuneeseen päivittäin ja kuukausittain sopimuksen
  tuntirajaa vasten. **Päiväkotikohtainen asetus, oletuksena pois päältä.**
  Laskutusta ei ole — vain luvut joiden päälle se voidaan rakentaa.
- **Allergiat ja ruokavaliot** — allergia näkyy punaisena varoituksena joka
  paikassa, ruokavalio erikseen; henkilökunta saa kirjata molemmat
- **Viestit** — huoltajan ja henkilökunnan välillä, liitteineen
- **Ruokalista** — käsin syötettynä tai automaattisesti Aromi-järjestelmästä
- **Retket ja luvat** — huoltaja vastaa lupapyyntöön sovelluksessa
- **Lomakkeet** — päiväkoti luo, huoltaja täyttää
- **Tiedotteet ja dokumentit**
- **Push-ilmoitukset** puhelimeen
- **CSV-raportit** — lapsilista, merkinnät, poissaolot, läsnäolo
- **GDPR-itsepalvelu** — huoltaja saa omat tietonsa ulos tai poistettavaksi
- **Auditointiloki** — kirjaa kuka teki mitä ja millaiselle tietueelle. Tunnisteet tiivistetään. Ei nimiä, ei viestien sisältöä, ei lapsen tietoja. Kirjautumisyrityksestä tallentuu **IP-osoite**, joka on henkilötietoa; rajapinta ei koskaan palauta sitä, ja se poistuu säilytysajan mukana
- **Automaattinen säilytysaikojen siivous** — öinen ajo, konfiguroitava

Sama koodi ajaa selaimessa, iOS:llä ja Androidilla.

---

## Mitä sovellus EI tee

Lue tämä ennen kuin lupaat kenellekään mitään.

| Puuttuva | Mitä se tarkoittaa |
|---|---|
| **Varda-tiedonsiirto** | Ei siirrä tietoja Opetushallituksen tietovarantoon. Kunnalla ja yksityisellä toimijalla on tähän lakisääteinen velvoite, ja se hoidetaan jatkossakin muualla. |
| **Suomi.fi-tunnistautuminen ja -valtuudet** | Kirjautuminen on sähköposti ja salasana. Ei vahvaa tunnistautumista. |
| **Hakemus ja sijoituspäätös** | Ei hakemusten käsittelyä eikä päätöksiä. |
| **Asiakasmaksut ja laskutus** | Ei maksuja, ei laskutusaineistoa, ei palveluseteliä. |
| **Vasu** | Ei varhaiskasvatussuunnitelman asiakirjaa. |
| **Henkilöstön työvuorot ja mitoitus** | Ei työvuorosuunnittelua eikä mitoituslaskentaa. |

**Käytännön johtopäätös:** Rutiini on huoltajaviestinnän ja päivittäisen kirjaamisen
työkalu. Se ei korvaa sitä järjestelmää jossa viralliset tiedot ovat, eikä se
läpäise kunnan kilpailutuksen pakollisia vaatimuksia sellaisenaan. Yksityiselle
päiväkodille se toimii sellaisenaan.

---

## Missä tilassa se on

| | |
|---|---|
| Omaa koodia | 29 584 riviä |
| Tietokantatauluja | 26 |
| API-päätepisteitä | 106 |
| Sivuja | 31 |
| Kieliä | 6 |
| Yksikkötestejä | 350, 16 tiedostossa |
| Selaintestejä | 12 skriptiä |
| Henkilötietoreittejä pääkäyttäjältä suljettuna | 23 |

Typecheck, testit ja tuotantobuild ovat puhtaat. CI ajaa nämä jokaisella pushilla
ja kääntää myös Android-debug-APK:n.

**Asiakkaita: nolla.** Sovellusta ei ole ajettu tuotannossa oikealla päiväkodilla.
Kaikki yllä oleva on todennettu testeillä ja selainajoilla, ei arjen käytöllä.

---

## Mitä on tehty

**Perusta** — moniasiakkuus päiväkodeittain, roolipohjaiset oikeudet, kuuden kielen
käännökset, mobiilikuoret Capacitorilla, Docker ja itse ajettava asennus.

**Tietosuoja** — pääkäyttäjän eristys lasten ja huoltajien tiedoista,
auditointiloki ilman nimiä tai lapsen tietoja (kirjautumisen IP-osoite tallentuu,
ks. yllä), säilytysaikojen automaattinen toteutus, GDPR-vienti ja poistopyynnöt,
DPIA-materiaali. Tenanttieristys on todennettu ajamalla oikeita reittejä vasten
hyökkäystestit, jotka on varmistettu kaatumaan kun suojaus poistetaan.

**Suorituskyky** — tietokantaindeksit, tunnistautumisen kysely yhteen hakuun,
listojen sivutus, N+1-kyselyiden purku, vastausten pakkaus, monen instanssin
turvallinen välimuisti ja ajastettujen töiden lukitus.

**Korjatut viat** — nämä olivat aitoja ja todennettiin molempiin suuntiin:

- Virheenkäsittelijä tuhosi pooliin palautuvan socketin, jolloin *seuraava*
  pyyntö kaatui verkkovirheeseen
- CSV-viennit kantoivat Excel-kaavoja (kaavainjektio)
- Sivupalkki sulkeutui itsestään jokaisella navigoinnilla työpöydällä
- Poissaolot laskettiin ilmoituksina eikä lapsina, jolloin läsnäoloprosentti meni
  väärin
- Salasanan palautus hyväksyttiin ilman SMTP:tä ja viesti katosi hiljaa
- Mobiilisovellus ei tavoittanut palvelinta ilman `VITE_API_URL`:ia ja CORS-sääntöjä

**Viimeisimmät muutokset**

- *Allergiat ja ruokavalio* — kaksi erillistä kenttää, koska allergia on
  turvallisuustieto ja ruokavalio ei. Samalla lisättiin lapsen muokkausreitti, jota
  ei aiemmin ollut lainkaan: allergian korjaaminen olisi vaatinut lapsen
  poistamisen ja vienyt kaikki merkinnät mukanaan.
- *Oikeuksien korotus tukittu* — henkilökunta pystyi luomaan itselleen
  johtajatunnuksen API-kutsulla ja saamaan kaikki oikeudet jotka heiltä on
  tarkoituksella evätty. Tilin luominen ja roolin valinta ovat nyt eri oikeuksia.

---

## Mitä seuraavaksi

**Ennen ensimmäistä käyttäjää**

1. Palvelin pystyyn HTTPS-osoitteeseen — ilman tätä demoa ei voi näyttää
2. `npm run db:push` — luo allergia- ja ruokavaliosarakkeet sekä hoitoaikataulut
3. `JWT_SECRET` ja `SMTP_HOST` asetettuna; tuotanto kieltäytyy käynnistymästä ilman

**Tiedossa olevat puutteet joita ei ole korjattu**

- `/trips`-sivuun ei johda yhtään linkkiä koko sovelluksessa. Sivu toimii, mutta
  siihen pääsee vain kirjoittamalla osoitteen. Retket ovat käytännössä piilossa.
- Henkilökunnan rajaus on epäjohdonmukainen: he näkevät koko päiväkodin lapsilistan
  ja saavat muokata kaikkien allergioita, mutta merkintöihin pääsevät vain omien
  ryhmiensä osalta. Allergiat pidettiin päiväkotilaajuisina tarkoituksella —
  sijainen ruokailussa tarvitsee tiedon — mutta valinta on syytä tehdä tietoisesti.
- Demotunnukset ovat seed-datassa geneerisiä. Jos sovellusta esitellään ulkopuolisille,
  ne kannattaa nimetä uudelleen.

**Jos sovellusta viedään kuntamarkkinalle**

Järjestyksessä: Varda-integraatio, Suomi.fi-tunnistautuminen, asiakasmaksut,
hoitoaikavaraukset. Ilman näitä tarjous hylätään pakollisissa vaatimuksissa ennen
kuin tuotetta ehditään arvioida.

---

## Historia

Rutiini on kehitetty noin yhdeksän kuukauden ajan vuoden 2025 lopulta alkaen,
alun perin Replit-alustalla. Koodikanta siirrettiin Gitiin elokuussa 2026, joten
tämän repositorion historia alkaa siirrosta eikä kehityksen alusta. Kehityksen
aikana pidetty muistiinpanotiedosto `replit.md` on säilynyt git-historiassa ja
sisältää päivättyjä merkintöjä joulukuulta 2025.
