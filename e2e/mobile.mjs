/**
 * Every authenticated page, for every role, at phone size.
 *
 * The product ships as an iOS and Android build, so a page that only works at
 * desktop width is broken for most of the people using it. Three things are checked
 * on each page:
 *
 *  - Horizontal overflow. A table, a wide button row or a long unbroken word pushes
 *    the document wider than the screen, and the whole page then slides sideways
 *    under the thumb with part of it permanently off the edge. This is the failure
 *    that pays for the script.
 *  - Errors in the console or a failed API call.
 *  - A page that renders nothing, as distinct from one correctly refusing the role.
 *
 * Then the drawer itself, per role: at this width the menu is the only way to move
 * around, so it has to open, take a tap, and get out of the way afterwards.
 */

import { chromium } from 'playwright';
import { signIn, changePasswordIfPrompted, isEnvironmentNoise, BASE } from './lib.mjs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2];

// iPhone 13/14 in portrait, the narrowest mainstream size worth supporting.
const VIEWPORT = { width: 390, height: 844 };

const COMMON = ['/dashboard', '/children', '/menu', '/absences', '/trips', '/forms', '/messages', '/documents', '/settings'];

const ROLES = [
  {
    label: 'Huoltaja', role: 'guardian',
    email: 'mikko@example.fi', next: 'Mikko2026!Turva',
    pages: [...COMMON, '/gdpr'],
  },
  {
    label: 'Henkilökunta', role: 'staff',
    email: 'maria@aurinko.fi', next: 'Maria2026!Turva',
    pages: [...COMMON, '/entries/new', '/users', '/delete-requests'],
  },
  {
    label: 'Johtaja', role: 'daycareleader',
    email: 'admin@aurinko.fi', next: 'Johtaja2026!Turva',
    pages: [...COMMON, '/entries/new', '/users', '/delete-requests', '/audit-logs'],
  },
  {
    // Signs in through its own screen rather than the municipality picker.
    label: 'Pääkäyttäjä', role: 'super_admin',
    email: 'superadmin@roolit.fi', password: 'admin123', next: 'SuperAdmin2026!Turva',
    pages: ['/dashboard', '/super-admin/stats', '/super-admin/municipalities',
            '/super-admin/users', '/super-admin/audit-logs', '/daycares', '/settings'],
  },
];

let problems = 0;
const browser = await chromium.launch({ executablePath: EXE });

/** The super admin has its own sign-in screen; everyone else uses the picker. */
async function signInAs(page, r) {
  if (r.role !== 'super_admin') {
    await signIn(page, { daycare: 'aurinko', role: r.role, email: r.email, password: ['password123', r.next] });
    await changePasswordIfPrompted(page, 'password123', r.next);
    return;
  }

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.getByTestId('button-super-admin-access').click();
  await page.waitForTimeout(1200);
  for (const candidate of [r.password, r.next]) {
    await page.getByTestId('input-super-admin-email').fill(r.email);
    await page.getByTestId('input-super-admin-password').fill(candidate);
    await page.getByTestId('button-super-admin-login').click();
    await page.waitForTimeout(2200);
    if ((await page.getByTestId('input-super-admin-email').count()) === 0) break;
  }
  await changePasswordIfPrompted(page, r.password, r.next);
}

/** What is sticking out, named so the report points at something findable. */
async function measure(page) {
  return page.evaluate(() => {
    const offenders = [];
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) {
        const cls = typeof el.className === 'string' && el.className
          ? '.' + el.className.split(/\s+/).slice(0, 2).join('.')
          : '';
        offenders.push(`${el.tagName.toLowerCase()}${cls} (oikea reuna ${Math.round(rect.right)}px)`);
      }
    }
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      offenders: offenders.slice(0, 3),
      body: (document.querySelector('main')?.innerText || '').trim(),
    };
  });
}

for (const r of ROLES) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  const note = (t) => { if (!isEnvironmentNoise(t)) errors.push(t.slice(0, 120)); };
  page.on('pageerror', (e) => note(`[pageerror] ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`[console] ${m.text()}`); });
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      note(`[http] ${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
    }
  });

  console.log(`\n=== ${r.label} (${r.role}) ${VIEWPORT.width}x${VIEWPORT.height} ===`);
  try {
    await signInAs(page, r);

    for (const path of r.pages) {
      const before = errors.length;
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);

      const landed = page.url().replace(BASE, '') || '/';
      if (!landed.startsWith(path)) { console.log(`  ohjattu  ${path.padEnd(28)} -> ${landed}`); continue; }

      const m = await measure(page);
      const newErrs = errors.slice(before);
      const overflows = m.scrollW > m.innerW + 1;
      // A short page is what a role correctly being refused looks like.
      const denied = /pääsy estetty|access denied|ei ole niihin pääsyä/i.test(m.body);

      let flag = 'ok';
      if (newErrs.length) { flag = 'VIRHE'; problems++; }
      else if (overflows) { flag = 'YLIVUOTO'; problems++; }
      else if (denied) flag = 'estetty';
      else if (m.body.length < 15) { flag = 'TYHJÄ'; problems++; }

      console.log(`  ${flag.padEnd(8)} ${path.padEnd(28)} leveys ${m.scrollW}/${m.innerW}`);
      m.offenders.forEach((o) => { if (overflows) console.log(`           ulkonee: ${o}`); });
      newErrs.forEach((e) => console.log(`           ${e}`));
    }

    // The drawer is the whole navigation at this width.
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1300);
    const toggle = page.getByTestId('button-sidebar-toggle');

    if ((await toggle.count()) === 0) {
      console.log('  ONGELMA  valikon avauspainiketta ei löydy'); problems++;
    } else {
      await toggle.click();
      await page.waitForTimeout(900);

      // Scoped to the drawer. A page can carry its own link- testids -- the super
      // admin's dashboard has shortcuts to the admin and statistics screens -- and
      // those sit behind the open drawer with pointer-events disabled, so picking
      // one of those would time out and read as a broken menu.
      const drawer = page.locator('[data-mobile="true"]');
      const links = [];
      for (const el of await drawer.locator('[data-testid^="link-"]').all()) {
        const id = await el.getAttribute('data-testid');
        if (id && !/^link-(privacy|terms|contact)/.test(id)) links.push(id);
      }

      if (links.length === 0) {
        console.log('  ONGELMA  valikko ei auennut'); problems++;
      } else {
        const target = links.find((id) => id !== 'link-etusivu') ?? links[0];
        const before = page.url();
        await drawer.locator(`[data-testid="${target}"]`).first().click({ timeout: 6000 });
        await page.waitForTimeout(1400);
        const moved = page.url() !== before;
        const closed = (await page.locator('[data-mobile="true"]').count()) === 0;

        if (!moved) { console.log(`  ONGELMA  ${target} ei vienyt mihinkään`); problems++; }
        if (!closed) { console.log('  ONGELMA  valikko jäi auki ja peittää sivun'); problems++; }
        if (moved && closed) {
          console.log(`  valikko  ${links.length} linkkiä, ${target} -> ${page.url().replace(BASE, '')}, sulkeutui`);
        }
      }
    }

    if (OUT) await page.screenshot({ path: `${OUT}/mobile-${r.role}.png`, fullPage: true });
  } catch (e) {
    console.log('  KAATUI:', String(e).split('\n')[0].slice(0, 140));
    problems++;
  } finally {
    await ctx.close();
  }
}

await browser.close();
console.log(`\nongelmia yhteensä: ${problems}`);
process.exit(problems === 0 ? 0 : 1);
