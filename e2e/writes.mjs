import { newSession, signIn, changePasswordIfPrompted, BASE } from './lib.mjs';

const OUT = process.argv[2];
let failures = 0;

const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${label}${detail ? '  :: ' + detail.slice(0, 90) : ''}`);
  if (!cond) failures++;
};
async function toast(page, ms = 4500) {
  const region = page.locator('[role=region]').first();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = (await region.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (t) return t;
    await page.waitForTimeout(200);
  }
  return '';
}
const body = async (p) => (await p.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const has = async (p, id) => (await p.getByTestId(id).count()) > 0;
async function pick(page, id, index = 0) {
  if (!(await has(page, id))) return false;
  await page.getByTestId(id).click({ force: true });
  await page.waitForTimeout(500);
  const opts = page.locator('[role=option]');
  const n = await opts.count();
  if (!n) return false;
  await opts.nth(Math.min(index, n - 1)).click({ force: true });
  await page.waitForTimeout(400);
  return true;
}
const isOk = (t) => /onnistui|success|lisätt|lähetet|tallenn|luotu|ilmoitett/i.test(t);

// ================================================================= STAFF
{
  const { browser, page, errors } = await newSession();
  console.log('\n=== HENKILÖKUNTA: merkintä + viesti ===');
  try {
    await signIn(page, { daycare: 'aurinko', role: 'staff', email: 'maria@aurinko.fi', password: 'password123' });
    await changePasswordIfPrompted(page, 'password123', 'Maria2026!Turva');

    // --- merkintä ---
    await page.goto(BASE + '/entries/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    await pick(page, 'select-child', 0);
    await pick(page, 'select-entry-type', 0);
    if (await has(page, 'input-entry-value')) await page.getByTestId('input-entry-value').fill('Söi hyvin');
    const submitEntry = (await page.locator('[data-testid*="submit"], [data-testid*="button-create-entry"]').count());
    const ids = [];
    for (const el of await page.locator('[data-testid]').all()) ids.push(await el.getAttribute('data-testid'));
    const btn = ids.find((i) => i === 'button-create-entry');
    check('merkinnän tallennuspainike löytyy', !!btn, btn || ids.filter(i=>i&&/entry/i.test(i)).join(','));
    if (btn) {
      await page.getByTestId(btn).click({ force: true });
      const t = await toast(page);
      check('merkintä tallentui', isOk(t), t || '(ei ilmoitusta)');
    }
    await page.screenshot({ path: `${OUT}/w-entry-done.png` });

    // --- viesti huoltajalle ---
    await page.goto(BASE + '/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    if (await has(page, 'button-new-message')) await page.getByTestId('button-new-message').click({ force: true });
    await page.waitForTimeout(800);
    const mids = [];
    for (const el of await page.locator('[data-testid]').all()) mids.push(await el.getAttribute('data-testid'));
    console.log('    viestilomake:', mids.filter((i) => i && /recipient|message|send|textarea|child/i.test(i)).join(', ').slice(0, 180));
    await pick(page, 'select-recipient', 0);
    const ta = page.locator('textarea').first();
    if (await ta.count()) await ta.fill('Testiviesti henkilökunnalta');
    const sendBtn = mids.find((i) => i && /send-message|button-send/i.test(i));
    if (sendBtn) {
      await page.getByTestId(sendBtn).click({ force: true });
      const t = await toast(page);
      check('viesti lähti', isOk(t), t || '(ei ilmoitusta)');
    } else check('lähetyspainike löytyy', false, mids.filter(i=>i&&/send/i.test(i)).join(','));
    await page.screenshot({ path: `${OUT}/w-message.png` });
  } catch (e) {
    console.log('  KAATUI:', String(e).split('\n')[0].slice(0, 160));
    failures++;
  }
  errors.forEach((e) => console.log('    ' + e));
  await browser.close();
}

// ================================================================= GUARDIAN
{
  const { browser, page, errors } = await newSession();
  console.log('\n=== HUOLTAJA: poissaolo ===');
  try {
    await signIn(page, { daycare: 'aurinko', role: 'guardian', email: 'anna@example.fi', password: 'password123' });
    await changePasswordIfPrompted(page, 'password123', 'Anna2026!Turva');

    await page.goto(BASE + '/absences', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    const aids = [];
    for (const el of await page.locator('[data-testid]').all()) aids.push(await el.getAttribute('data-testid'));
    console.log('    poissaolosivu:', aids.filter((i) => i && /absence|report|select|input|submit|date/i.test(i)).join(', ').slice(0, 200));
    // The report form is on the page itself; button-report-absence submits it.
    await pick(page, 'select-absence-child', 0);
    await pick(page, 'select-absence-type', 0);
    const dateEl = page.locator('input[type=date]').first();
    if (await dateEl.count()) await dateEl.fill('2026-09-01');
    const fids = [];
    for (const el of await page.locator('[data-testid]').all()) fids.push(await el.getAttribute('data-testid'));
    const sub = fids.find((i) => i === 'button-report-absence');
    if (sub) {
      await page.getByTestId(sub).click({ force: true });
      const t = await toast(page);
      check('poissaolo ilmoitettu', isOk(t), t || '(ei ilmoitusta)');
    } else check('poissaolon lähetyspainike', false, fids.filter(i=>i&&/submit|absence/i.test(i)).join(','));
    await page.screenshot({ path: `${OUT}/w-absence.png` });
  } catch (e) {
    console.log('  KAATUI:', String(e).split('\n')[0].slice(0, 160));
    failures++;
  }
  errors.forEach((e) => console.log('    ' + e));
  await browser.close();
}

console.log(`\nepäonnistumisia: ${failures}`);
