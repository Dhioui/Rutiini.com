/**
 * Every authenticated page at phone size.
 *
 * The product ships as an iOS and Android build, so a page that only works at
 * desktop width is broken for most of the people using it. The check that pays for
 * itself here is horizontal overflow: a table, a wide button row or a long
 * unbroken word pushes the document wider than the screen, and the whole page then
 * slides sideways under the thumb with part of it permanently off the edge.
 */

import { chromium } from 'playwright';
import { signIn, changePasswordIfPrompted, BASE } from './lib.mjs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2];

// iPhone 13/14 in portrait, the narrowest mainstream size worth supporting.
const VIEWPORT = { width: 390, height: 844 };

const PAGES = [
  '/dashboard', '/children', '/entries/new', '/menu', '/absences',
  '/trips', '/forms', '/messages', '/documents', '/settings',
];

const ROLES = [
  { label: 'Huoltaja', role: 'guardian', email: 'mikko@example.fi', next: 'Mikko2026!Turva' },
  { label: 'Johtaja', role: 'daycareleader', email: 'admin@aurinko.fi', next: 'Johtaja2026!Turva' },
];

const IGNORED = [/fonts\.googleapis/, /ERR_CONNECTION_RESET/, /React DevTools/];

let problems = 0;
const browser = await chromium.launch({ executablePath: EXE });

for (const r of ROLES) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  const note = (t) => { if (!IGNORED.some((x) => x.test(t))) errors.push(t.slice(0, 120)); };
  page.on('pageerror', (e) => note(`[pageerror] ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`[console] ${m.text()}`); });
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      note(`[http] ${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
    }
  });

  console.log(`\n=== ${r.label} (${r.role}) ${VIEWPORT.width}x${VIEWPORT.height} ===`);
  try {
    await signIn(page, { daycare: 'aurinko', role: r.role, email: r.email, password: ['password123', r.next] });
    await changePasswordIfPrompted(page, 'password123', r.next);

    for (const path of PAGES) {
      const before = errors.length;
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);

      const landed = page.url().replace(BASE, '') || '/';
      if (!landed.startsWith(path)) { console.log(`  ohjattu  ${path} -> ${landed}`); continue; }

      const measured = await page.evaluate(() => {
        const doc = document.documentElement;
        // Whatever is actually sticking out, so the report names something findable.
        const offenders = [];
        for (const el of Array.from(document.querySelectorAll('main *'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth + 1) {
            offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''} (oikea reuna ${Math.round(r.right)}px)`);
          }
        }
        return {
          scrollW: doc.scrollWidth,
          innerW: window.innerWidth,
          offenders: offenders.slice(0, 3),
          body: (document.querySelector('main')?.innerText || '').trim(),
        };
      });

      const newErrs = errors.slice(before);
      const overflows = measured.scrollW > measured.innerW + 1;
      // A short page is what a role correctly being refused looks like.
      const denied = /pääsy estetty|access denied/i.test(measured.body);

      let flag = 'ok';
      if (newErrs.length) { flag = 'VIRHE'; problems++; }
      else if (overflows) { flag = 'YLIVUOTO'; problems++; }
      else if (denied) flag = 'estetty';
      else if (measured.body.length < 15) { flag = 'TYHJÄ'; problems++; }

      console.log(`  ${flag.padEnd(8)} ${path.padEnd(14)} leveys ${measured.scrollW}/${measured.innerW}`);
      if (overflows && measured.offenders.length) {
        measured.offenders.forEach((o) => console.log(`           ulkonee: ${o}`));
      }
      newErrs.forEach((e) => console.log(`           ${e}`));
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
