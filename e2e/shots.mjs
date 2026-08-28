import { newSession, signIn, changePasswordIfPrompted, BASE } from './lib.mjs';
const OUT = process.argv[2];

const SHOTS = [
  { role: 'daycareleader', email: 'admin@aurinko.fi', next: 'Johtaja2026!Turva',
    pages: ['/dashboard', '/children', '/messages', '/users', '/absences'] },
  { role: 'guardian', email: 'mikko@example.fi', next: 'Mikko2026!Turva',
    pages: ['/dashboard', '/children', '/menu', '/forms'] },
];

for (const s of SHOTS) {
  const { browser, page } = await newSession();
  await signIn(page, { daycare: 'aurinko', role: s.role, email: s.email, password: ['password123', s.next] });
  await changePasswordIfPrompted(page, 'password123', s.next);
  for (const p of s.pages) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const name = `${s.role}${p.replace(/\//g, '-')}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log('  ', name);
  }
  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${s.role}-mobile.png`, fullPage: true });
  console.log('   ', s.role + '-mobile');
  await browser.close();
}
// login, logged out
{
  const { browser, page } = await newSession();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/00-login.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/00-login-mobile.png` });
  console.log('   login + login-mobile');
  await browser.close();
}
