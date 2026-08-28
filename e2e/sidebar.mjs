/**
 * The sidebar has to survive being used.
 *
 * Every navigation link used to call setOpen(false), which drives the desktop
 * sidebar. On a wide screen that slid the whole sidebar off to the left after the
 * first click, so the rest of the navigation sat at a negative x coordinate and
 * could not be clicked at all; the state is kept in a cookie, so it stayed shut on
 * the next visit too. On a phone the drawer is a separate Sheet on `openMobile`,
 * which that call does not touch, so it went on covering the page just opened.
 *
 * Both sizes are checked here because the fix for one is what broke the other.
 */

import { chromium } from 'playwright';
import { signIn, changePasswordIfPrompted, BASE } from './lib.mjs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CREDENTIALS = {
  daycare: 'aurinko', role: 'staff', email: 'maria@aurinko.fi',
  password: ['password123', 'Maria2026!Turva'],
};

let problems = 0;
const fail = (m) => { console.log(`  ONGELMA: ${m}`); problems++; };
const ok = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });

async function session(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await signIn(page, CREDENTIALS);
  await changePasswordIfPrompted(page, 'password123', 'Maria2026!Turva');
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

/** `root` is a page or, on a phone, the drawer itself. */
const navLinks = async (root) => {
  const out = [];
  for (const el of await root.locator('[data-testid^="link-"]').all()) {
    const id = await el.getAttribute('data-testid');
    if (id && !/^link-(privacy|terms|contact)/.test(id)) out.push(id);
  }
  return out;
};

// ---------------------------------------------------------------- desktop
console.log('\n=== Työpöytä (1400x950) ===');
{
  const { ctx, page } = await session({ width: 1400, height: 950 });
  const links = await navLinks(page);
  console.log(`  navigaatiokohteita: ${links.length}`);

  for (const id of links) {
    const link = page.getByTestId(id).first();
    const box = await link.boundingBox();

    if (!box || box.x < 0) {
      fail(`${id}: sivupalkki on ruudun ulkopuolella (x=${box ? Math.round(box.x) : 'ei laatikkoa'})`);
      break;
    }

    const before = page.url();
    await link.click({ timeout: 6000 });
    await page.waitForTimeout(1000);

    if (page.url() === before && !before.endsWith('/dashboard')) {
      fail(`${id}: klikkaus ei vienyt mihinkään`);
    }
  }

  // Having walked the whole menu, it must all still be reachable.
  const after = [];
  for (const id of links) {
    const box = await page.getByTestId(id).first().boundingBox();
    if (!box || box.x < 0) after.push(id);
  }
  if (after.length) fail(`sivupalkki sulkeutui: ${after.length}/${links.length} linkkiä ruudun ulkopuolella`);
  else ok(`kaikki ${links.length} linkkiä yhä näkyvissä koko kierroksen jälkeen (${page.url().replace(BASE, '')})`);

  // Closing it on purpose must still work: the point is that navigating does not
  // close it, not that it can no longer be closed.
  const toggle = page.getByTestId('button-sidebar-toggle');
  const first = links[0];
  await toggle.click();
  await page.waitForTimeout(600);
  const collapsed = await page.getByTestId(first).first().boundingBox();
  if (collapsed && collapsed.x >= 0) fail('sivupalkki ei sulkeutunut painikkeesta');
  else ok('painike sulkee sivupalkin');

  await toggle.click();
  await page.waitForTimeout(600);
  const reopened = await page.getByTestId(first).first().boundingBox();
  if (!reopened || reopened.x < 0) fail('sivupalkki ei avautunut uudelleen painikkeesta');
  else ok('painike avaa sivupalkin uudelleen');

  await ctx.close();
}

// ---------------------------------------------------------------- phone
console.log('\n=== Puhelin (390x844) ===');
{
  const { ctx, page } = await session({ width: 390, height: 844 });

  // The menu is a drawer here, so it starts closed and is opened from the header.
  const toggle = page.getByTestId('button-sidebar-toggle');
  if ((await toggle.count()) === 0) {
    fail('sivupalkin avauspainiketta ei löydy');
  } else {
    await toggle.click();
    await page.waitForTimeout(900);

    // Scoped to the drawer: a page can carry its own link- testids, and those sit
    // behind the open drawer with pointer-events disabled.
    const drawer = page.locator('[data-mobile="true"]');
    const links = await navLinks(drawer);
    if (links.length === 0) {
      fail('laatikko ei auennut: ei navigaatiolinkkejä');
    } else {
      ok(`laatikko aukesi, ${links.length} linkkiä`);

      const target = links.find((id) => id !== 'link-etusivu') ?? links[0];
      const before = page.url();
      await drawer.locator(`[data-testid="${target}"]`).first().click({ timeout: 6000 });
      await page.waitForTimeout(1400);

      if (page.url() === before) fail(`${target}: klikkaus ei vienyt mihinkään`);
      else ok(`${target} vei sivulle ${page.url().replace(BASE, '')}`);

      // The drawer must be gone, or it covers the page it just opened.
      const stillOpen = await page.locator('[data-mobile="true"]').count();
      if (stillOpen > 0) fail('laatikko jäi auki valinnan jälkeen ja peittää sivun');
      else ok('laatikko sulkeutui valinnan jälkeen');
    }
  }

  await ctx.close();
}

await browser.close();
console.log(`\nyhteenveto: ${problems === 0 ? 'sivupalkki toimii molemmilla kokoluokilla' : problems + ' ongelmaa'}`);
process.exit(problems === 0 ? 0 : 1);
