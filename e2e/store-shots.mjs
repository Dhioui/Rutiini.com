/**
 * Store screenshots, taken from the real application.
 *
 * Replaces the former scripts/appstore-screenshots.ts, which signed in as
 * appstore-admin@rutiini.com with daycare code "rutiini". Neither exists -- the
 * seed creates admin@aurinko.fi under the code "aurinko" -- so it failed at the
 * login screen and produced nothing.
 *
 * Run it the same way as the end-to-end checks, which start the app and seed the
 * database first:
 *
 *     ./e2e/run.sh store-shots.mjs
 *
 * Output goes to store-screenshots/, one folder per size, named so the order in
 * the listing is the order of the files.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { signIn, changePasswordIfPrompted, BASE } from './lib.mjs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'store-screenshots';

/**
 * Sizes are given as CSS pixels plus a scale factor, because that is how a real
 * device renders: a 6.9" iPhone is 440 points wide at 3x, giving the 1320x2868
 * image the store asks for. Shooting at 1320 CSS pixels instead would produce a
 * tablet layout at phone dimensions.
 *
 * Check the exact current requirements in App Store Connect and Play Console
 * before uploading -- Apple in particular changes which sizes are mandatory.
 */
const SIZES = [
  { name: 'ios-6.9', w: 440, h: 956, scale: 3, note: '1320x2868 — iPhone 6.9"' },
  { name: 'ios-6.5', w: 414, h: 896, scale: 3, note: '1242x2688 — iPhone 6.5"' },
  { name: 'android-phone', w: 360, h: 640, scale: 3, note: '1080x1920 — Play phone' },
];

/**
 * What to show, and as whom. A store listing should lead with what the product
 * is for, so the daycare leader's dashboard comes first and the guardian's own
 * view second -- those are the two people who decide whether to install it.
 */
const SHOTS = [
  { role: 'daycareleader', email: 'admin@aurinko.fi', next: 'Johtaja2026!Turva',
    pages: [
      ['1-etusivu', '/dashboard'],
      ['2-lapset', '/children'],
      ['3-merkinta', '/entries/new'],
      ['4-ruokalista', '/menu'],
    ] },
  { role: 'guardian', email: 'mikko@example.fi', next: 'Mikko2026!Turva',
    pages: [
      ['5-huoltaja-etusivu', '/dashboard'],
      ['6-poissaolo', '/absences'],
      ['7-viestit', '/messages'],
      ['8-tiedot', '/gdpr'],
    ] },
];

const browser = await chromium.launch({ executablePath: EXE });
let taken = 0;

for (const size of SIZES) {
  const dir = `${OUT}/${size.name}`;
  mkdirSync(dir, { recursive: true });
  console.log(`\n=== ${size.name} — ${size.note} ===`);

  for (const person of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: size.scale,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();

    try {
      await signIn(page, {
        daycare: 'aurinko', role: person.role, email: person.email,
        password: ['password123', person.next],
      });
      await changePasswordIfPrompted(page, 'password123', person.next);

      for (const [label, path] of person.pages) {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
        // Long enough for the data to arrive: an empty list makes a poor advert.
        await page.waitForTimeout(2200);
        const file = `${dir}/${label}.png`;
        await page.screenshot({ path: file });
        console.log(`  ${label.padEnd(22)} ${path}`);
        taken++;
      }
    } catch (e) {
      console.log(`  VIRHE (${person.role}): ${String(e).split('\n')[0].slice(0, 100)}`);
    } finally {
      await ctx.close();
    }
  }
}

await browser.close();
console.log(`\nvalmista: ${taken} kuvaa kansiossa ${OUT}/`);
