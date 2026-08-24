import { newSession, text, testids, changePasswordIfPrompted, BASE } from './lib.mjs';

const OUT = process.argv[2];
let failures = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${label}${detail ? '  :: ' + detail.slice(0, 100) : ''}`);
  if (!cond) failures++;
};

const { browser, page, errors } = await newSession();
console.log('\n=== SUPER ADMIN ===');
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByTestId('button-super-admin-access').click({ force: true });
  await page.waitForTimeout(1200);
  console.log('  kirjautumissivu:', page.url());
  await page.getByTestId('input-super-admin-email').fill('superadmin@roolit.fi');
  await page.getByTestId('input-super-admin-password').fill('admin123');
  await page.getByTestId('button-super-admin-login').click({ force: true });
  await page.waitForTimeout(2500);
  const changed = await changePasswordIfPrompted(page, 'admin123', 'SuperAdmin2026!Turva');
  console.log('  pakollinen salasanan vaihto:', changed, '| URL:', page.url());
  console.log('  näkymä:', (await text(page)).slice(0, 200));
  await page.screenshot({ path: `${OUT}/sa-login.png`, fullPage: true });

  const PAGES = ['/dashboard', '/super-admin/stats', '/super-admin/municipalities',
                 '/super-admin/users', '/super-admin/audit-logs', '/daycares'];
  for (const path of PAGES) {
    const before = errors.length;
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    const main = (await page.locator('main').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const newErrs = errors.slice(before);
    const landed = page.url().replace(BASE, '') || '/';
    const flag = newErrs.length ? 'VIRHE' : (main.length < 15 ? 'TYHJÄ' : 'ok');
    if (flag !== 'ok') failures++;
    console.log(`  ${flag.padEnd(6)} ${path.padEnd(30)} -> ${landed.padEnd(30)} ${main.slice(0, 55)}`);
    newErrs.forEach((e) => console.log('          ' + e));
  }

  // GDPR: personal data must stay out of reach.
  console.log('\n  --- GDPR: henkilötiedot estettävä ---');
  for (const path of ['/children', '/entries/new', '/messages', '/absences']) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1100);
    const main = (await page.locator('main').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const blocked = /pääsy estetty|access denied|GDPR|ei ole oikeuksia/i.test(main);
    check(`${path} estetty`, blocked, main.slice(0, 70));
  }
  await page.screenshot({ path: `${OUT}/sa-gdpr.png`, fullPage: true });
} catch (e) {
  console.log('  KAATUI:', String(e).split('\n')[0].slice(0, 170));
  failures++;
}
errors.forEach((e) => console.log('  ' + e));
await browser.close();
console.log(`\nepäonnistumisia: ${failures}`);
