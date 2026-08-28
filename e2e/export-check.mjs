import { newSession, signIn, changePasswordIfPrompted, BASE } from '/home/user/Rutiini.com/e2e/lib.mjs';

const { browser, page } = await newSession();
let problems = 0;

page.on('console', (m) => {
  if (m.type() === 'error') console.log('  KONSOLIVIRHE:', m.text().slice(0, 120));
});

await signIn(page, {
  daycare: 'aurinko', role: 'daycareleader',
  email: 'admin@aurinko.fi', password: ['password123', 'Johtaja2026!Turva'],
});
await changePasswordIfPrompted(page, 'password123', 'Johtaja2026!Turva');
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

const buttons = [
  ['button-export-children', 'lapset'],
  ['button-export-entries', 'merkinnat'],
  ['button-export-absences', 'poissaolot'],
  ['button-export-attendance', 'lasnaolo'],
];

for (const [testid, expectPrefix] of buttons) {
  const button = page.locator(`[data-testid="${testid}"]`);
  if (await button.count() === 0) { console.log(`  ${testid}: EI LÖYDY`); problems++; continue; }
  await button.scrollIntoViewIfNeeded();

  const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await button.click();
  const download = await downloadPromise;

  if (!download) { console.log(`  ${testid}: EI LATAUSTA`); problems++; continue; }

  const name = download.suggestedFilename();
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const head = readFileSync(path, 'utf8').split('\n')[0].slice(0, 60);

  const ok = name.startsWith(expectPrefix) && !head.includes('error');
  console.log(`  ${testid}: ${ok ? 'ok' : 'ONGELMA'}  tiedosto=${name}  1. rivi="${head}"`);
  if (!ok) problems++;
}

// The URL must not have navigated away to a JSON error page.
console.log(`  sivu edelleen: ${new URL(page.url()).pathname}`);
if (new URL(page.url()).pathname !== '/dashboard') problems++;

await browser.close();
console.log(`\nyhteenveto: ${problems === 0 ? 'kaikki 4 vientiä toimivat' : problems + ' ongelmaa'}`);
process.exit(problems === 0 ? 0 : 1);
