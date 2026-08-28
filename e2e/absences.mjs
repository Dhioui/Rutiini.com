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

const report = () =>
  api('/api/absences', {
    token: guardian,
    method: 'POST',
    body: { childId, date, type: 'sickness', reason: 'kuumetta' },
  });

// 200 when this script got there first, 409 when writes.mjs already reported the
// same child today: the database is reset per run, not per script. Either way the
// day is now on record exactly once, which is what the rest of this checks.
const first = await report();
if (first.status === 200) ok('ensimmäinen poissaoloilmoitus hyväksyttiin');
else if (first.status === 409) ok('päivä oli jo ilmoitettu aiemmassa skriptissä (409)');
else fail(`ensimmäinen ilmoitus palautti ${first.status}, odotettiin 200 tai 409`);

const second = await report();
if (second.status === 409) ok('toinen ilmoitus samalle päivälle hylättiin (409)');
else fail(`toinen ilmoitus palautti ${second.status}, odotettiin 409`);

const third = await report();
if (third.status === 409) ok('kolmas ilmoitus hylättiin myös');
else fail(`kolmas ilmoitus palautti ${third.status}, odotettiin 409`);

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
