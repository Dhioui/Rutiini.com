import { newSession, text, testids, signIn, changePasswordIfPrompted } from './lib.mjs';

const OUT = process.argv[2];
const results = [];

async function journey(name, fn) {
  const { browser, page, errors } = await newSession();
  const log = [];
  try {
    await fn(page, (m) => log.push('    ' + m), errors);
  } catch (e) {
    errors.push(`[THREW] ${String(e).split('\n')[0].slice(0, 160)}`);
  } finally {
    await browser.close();
  }
  results.push({ name, errors, log });
}

/** Visit each sidebar destination and report anything that errors or renders empty. */
/**
 * Click every sidebar destination, the way a person does.
 *
 * The clicks are ordinary ones. They used to pass `force`, on the reasoning that a
 * hover transition kept Playwright's stability wait from settling -- but the real
 * cause was that each link closed the sidebar, so from the second click onwards
 * the whole menu sat at a negative x coordinate. `force` only turned that into a
 * different error message. A plain click is also the point of this walk: it fails
 * if the navigation is not genuinely usable.
 *
 * A link that cannot be opened is recorded as an error rather than only printed,
 * so a journey that could not use the menu is not reported as a clean run.
 */
async function walkNav(page, say, errors) {
  const links = (await testids(page)).filter((t) => t.startsWith('link-') && !t.startsWith('link-privacy') && !t.startsWith('link-terms') && !t.startsWith('link-contact'));
  say(`navigaatiokohteita: ${links.length}`);
  for (const id of links) {
    try {
      // Press Escape first: a toast can sit over the sidebar and swallow the click.
      await page.keyboard.press('Escape').catch(() => {});
      await page.getByTestId(id).first().click({ timeout: 6000 });
      await page.waitForTimeout(1500);
      const body = await page.locator('main').first().innerText().catch(() => '');
      const short = body.replace(/\s+/g, ' ').trim().slice(0, 80);
      say(`${id.padEnd(22)} ${page.url().replace('http://localhost:5100', '').padEnd(18)} ${short || '(TYHJÄ SIVU)'}`);
    } catch (e) {
      say(`${id.padEnd(22)} EI VOINUT AVATA: ${String(e).split('\n')[0].slice(0, 70)}`);
      errors.push(`[nav] ${id}: ${String(e).split('\n')[0].slice(0, 100)}`);
    }
  }
}

await journey('Huoltaja (Mikko, Aurinko)', async (page, say, errors) => {
  await signIn(page, { daycare: 'aurinko', role: 'guardian', email: 'mikko@example.fi', password: ['password123', 'Mikko2026!Turva'] });
  await changePasswordIfPrompted(page, 'password123', 'Mikko2026!Turva');
  say('URL: ' + page.url());
  await walkNav(page, say, errors);
  await page.screenshot({ path: `${OUT}/r-guardian.png`, fullPage: true });
});

await journey('Henkilökunta (Maria, Aurinko)', async (page, say, errors) => {
  await signIn(page, { daycare: 'aurinko', role: 'staff', email: 'maria@aurinko.fi', password: ['password123', 'Maria2026!Turva'] });
  await changePasswordIfPrompted(page, 'password123', 'Maria2026!Turva');
  say('URL: ' + page.url());
  await walkNav(page, say, errors);
  await page.screenshot({ path: `${OUT}/r-staff.png`, fullPage: true });
});

await journey('Johtaja (Admin, Aurinko)', async (page, say, errors) => {
  await signIn(page, { daycare: 'aurinko', role: 'daycareleader', email: 'admin@aurinko.fi', password: ['password123', 'Johtaja2026!Turva'] });
  await changePasswordIfPrompted(page, 'password123', 'Johtaja2026!Turva');
  say('URL: ' + page.url());
  await walkNav(page, say, errors);
  await page.screenshot({ path: `${OUT}/r-leader.png`, fullPage: true });
});

let bad = 0;
for (const r of results) {
  console.log(`\n=== ${r.name} ===`);
  r.log.forEach((l) => console.log(l));
  if (r.errors.length) { bad++; console.log('  VIRHEET:'); r.errors.forEach((e) => console.log('   ' + e)); }
  else console.log('  virheitä: ei');
}
console.log(`\nyhteenveto: ${results.length - bad}/${results.length} polkua ilman virheitä`);
