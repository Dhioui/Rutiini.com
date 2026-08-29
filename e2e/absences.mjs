/**
 * One child away has to count as one child away.
 *
 * The same day could be reported for the same child any number of times, and the
 * dashboard counted absence rows rather than absent children. Three reports for one
 * of three children put the attendance figure at 0%: the leader's main screen said
 * nobody was present while two children were. Reporting twice is easy to do from a
 * phone -- a tap that does not look like it registered, or a form sent again on a
 * slow connection -- and each report also notified the whole staff afresh.
 */

const BASE = process.env.E2E_BASE || 'http://localhost:5100';

let problems = 0;
const fail = (m) => { console.log(`  ONGELMA: ${m}`); problems++; };
const ok = (m) => console.log(`  ok    ${m}`);

async function api(path, { token, method = 'GET', body } = {}) {
  return fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Both passwords, because the database is reset per run rather than per script.
async function login(role, email, passwords) {
  for (const password of passwords) {
    const res = await api(`/api/auth/login/${role}`, {
      method: 'POST',
      body: { email, password, daycareCode: 'aurinko' },
    });
    if (res.ok) return (await res.json()).token;
  }
  return null;
}

const guardian = await login('guardian', 'anna@example.fi', ['password123', 'Anna2026!Turva']);
const leader = await login('daycareleader', 'admin@aurinko.fi', ['password123', 'Johtaja2026!Turva']);
if (!guardian || !leader) {
  console.log('  ONGELMA: kirjautuminen epäonnistui');
  process.exit(1);
}

const children = await (await api('/api/children', { token: guardian })).json();
const childId = children[0].id;
const date = new Date().toISOString().split('T')[0];

const report = (type = 'sickness', reason = 'kuumetta') =>
  api('/api/absences', {
    token: guardian,
    method: 'POST',
    body: { childId, date, type, reason },
  });

const first = await report();
if (first.status === 200) ok('poissaoloilmoitus hyväksyttiin');
else fail(`ilmoitus palautti ${first.status}, odotettiin 200`);
const firstBody = first.status === 200 ? await first.json() : {};

// A repeat of the identical report -- a double tap, or a form sent again on a
// slow connection -- must not add a second row or notify anybody again.
const repeat = await report();
if (repeat.status !== 200) fail(`sama ilmoitus uudelleen palautti ${repeat.status}, odotettiin 200`);
else {
  const body = await repeat.json();
  if (body.id !== firstBody.id) fail('sama ilmoitus loi uuden rivin');
  else ok('sama ilmoitus uudelleen ei luonut toista riviä');
}

// A genuinely different report for the same day has to survive: a child can
// arrive late and also be collected early, and both concern the staff.
const other = await report('early_pickup', 'hammaslääkäri');
if (other.status !== 200) fail(`toinen eri ilmoitus palautti ${other.status}, odotettiin 200`);
else {
  const body = await other.json();
  if (body.id === firstBody.id) fail('eri ilmoitus korvasi aiemman rivin');
  else ok('eri ilmoitus samalle päivälle tallentui omana rivinään');
}

const stats = await (await api('/api/daycare/stats', { token: leader })).json();
console.log(`  lapsia ${stats.childrenCount}, poissa ${stats.absencesToday}, läsnäolo ${stats.attendanceRate}%`);

if (stats.absencesToday !== 1) fail(`poissaolevia laskettiin ${stats.absencesToday}, pitäisi olla 1`);
else ok('poissaolevia lasketaan lapsina, ei ilmoituksina');

const expected = Math.round(((stats.childrenCount - 1) / stats.childrenCount) * 100);
if (stats.attendanceRate !== expected) fail(`läsnäolo ${stats.attendanceRate}%, pitäisi olla ${expected}%`);
else ok(`läsnäolo ${stats.attendanceRate}% vastaa yhtä poissaolevaa lasta`);

if (stats.attendanceRate < 0) fail('läsnäolo on negatiivinen');

console.log(`\nyhteenveto: ${problems === 0 ? 'poissaolot lasketaan oikein' : problems + ' ongelmaa'}`);
process.exit(problems === 0 ? 0 : 1);
