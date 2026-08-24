import { newSession, BASE } from './lib.mjs';
import net from 'net';

const OUT = process.argv[2];
let failures = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${label}${detail ? '  :: ' + String(detail).slice(0, 90) : ''}`);
  if (!cond) failures++;
};

// A throwaway SMTP server that captures the reset link out of the message body.
function captureLink(port) {
  return new Promise((resolve) => {
    const server = net.createServer((sock) => {
      let data = '', inData = false;
      sock.write('220 localhost sink\r\n');
      sock.on('data', (chunk) => {
        const text = chunk.toString();
        if (inData) {
          data += text;
          if (text.includes('\r\n.\r\n')) {
            inData = false;
            const decoded = data.replace(/=\r\n/g, '')
              .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
            const m = decoded.match(/https?:\/\/\S*reset-password\?token=[A-Za-z0-9]+/);
            sock.write('250 OK\r\n');
            server.close();
            resolve(m ? m[0] : null);
          }
          return;
        }
        for (const line of text.split('\r\n').filter(Boolean)) {
          if (/^EHLO|^HELO/i.test(line)) sock.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (/^AUTH/i.test(line)) sock.write('235 OK\r\n');
          else if (/^DATA/i.test(line)) { inData = true; sock.write('354 go\r\n'); }
          else if (/^QUIT/i.test(line)) { sock.write('221 Bye\r\n'); sock.end(); }
          else sock.write('250 OK\r\n');
        }
      });
      sock.on('error', () => {});
    });
    server.listen(port);
    setTimeout(() => { try { server.close(); } catch {} resolve(null); }, 25000);
  });
}

console.log('\n=== SALASANAN PALAUTUS PÄÄSTÄ PÄÄHÄN ===');
const linkPromise = captureLink(2530);

const res = await fetch(`${BASE}/api/auth/reset-password/request`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria@aurinko.fi', daycareCode: 'aurinko' }),
});
check('palautuspyyntö hyväksyttiin', res.ok, `HTTP ${res.status}`);

const link = await linkPromise;
check('sähköposti sisälsi linkin', !!link, link ?? '');
if (!link) { console.log(`\nepäonnistumisia: ${failures}`); process.exit(failures ? 1 : 0); }

// Follow the link against this deployment rather than the public host in the mail.
const localLink = link.replace(/^https?:\/\/[^/]+/, BASE);
const { browser, page, errors } = await newSession();
const NEW = 'Palautettu2026!Turva';
try {
  await page.goto(localLink, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check('linkki avaa palautussivun eikä 404:ää', !/not found|404/i.test(body), body.slice(0, 70));
  await page.screenshot({ path: `${OUT}/reset-page.png` });

  await page.getByTestId('input-new-password').fill(NEW);
  await page.getByTestId('input-confirm-password').fill(NEW);
  await page.getByTestId('button-reset-password').click({ force: true });
  await page.waitForTimeout(2500);
  check('salasana vaihtui', (await page.getByTestId('text-reset-done').count()) > 0,
        (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 70));
  await page.screenshot({ path: `${OUT}/reset-done.png` });
} catch (e) {
  check('palautussivu toimii', false, String(e).split('\n')[0]);
} finally {
  errors.forEach((e) => console.log('    ' + e));
  await browser.close();
}

// The new password works, the old one does not, and the link is spent.
const signIn = async (password) => (await fetch(`${BASE}/api/auth/login/staff`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria@aurinko.fi', password, daycareCode: 'aurinko' }),
})).status;

check('uusi salasana toimii', await signIn(NEW) === 200);
check('vanha salasana ei toimi', await signIn('password123') === 401);

const reuse = await fetch(`${BASE}/api/auth/reset-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: new URL(link).searchParams.get('token'), newPassword: 'Toinen2026!Yritys' }),
});
check('linkkiä ei voi käyttää uudelleen', reuse.status === 400, `HTTP ${reuse.status}`);

console.log(`\nepäonnistumisia: ${failures}`);
process.exit(failures ? 1 : 0);
