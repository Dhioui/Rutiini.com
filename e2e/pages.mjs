import { newSession, signIn, changePasswordIfPrompted, BASE } from './lib.mjs';

const OUT = process.argv[2];

/** Every authenticated page, excluding the pre-login and super-admin flows. */
const PAGES = [
  '/dashboard', '/children', '/entries/new', '/menu', '/absences',
  '/trips', '/forms', '/messages', '/documents', '/gdpr', '/settings',
  '/users', '/daycares', '/audit-logs', '/delete-requests',
];

const ONLY = process.env.E2E_ROLE;
const ROLES_ALL = [
  { label: 'Huoltaja',      role: 'guardian',      email: 'mikko@example.fi',  next: 'Mikko2026!Turva' },
  { label: 'Henkilökunta',  role: 'staff',         email: 'maria@aurinko.fi',  next: 'Maria2026!Turva' },
  { label: 'Johtaja',       role: 'daycareleader', email: 'admin@aurinko.fi',  next: 'Johtaja2026!Turva' },
];
const ROLES = ONLY ? ROLES_ALL.filter((r) => r.role === ONLY) : ROLES_ALL;

let problems = 0;

for (const r of ROLES) {
  const { browser, page, errors } = await newSession();
  console.log(`\n=== ${r.label} (${r.role}) ===`);
  try {
    await signIn(page, { daycare: 'aurinko', role: r.role, email: r.email, password: ['password123', r.next] });
    await changePasswordIfPrompted(page, 'password123', r.next);

    for (const path of PAGES) {
      const before = errors.length;
      // domcontentloaded, not networkidle: the sandbox has no outbound network, so the
      // Google Fonts request never settles and networkidle waits for its full timeout.
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1100);
      const landed = page.url().replace(BASE, '') || '/';
      const main = await page.locator('main').first().innerText().catch(() => '');
      const body = main.replace(/\s+/g, ' ').trim();
      const newErrs = errors.slice(before);
      const redirected = !landed.startsWith(path);
      const empty = body.length < 15;

      // A short body is expected when the page is correctly refusing a role.
      const denied = /pääsy estetty|access denied/i.test(body);
      // A raw role identifier on screen means a translation key is missing.
      const rawKey = /\b(daycareleader|super_admin)\b/.test(body);
      if (rawKey) { console.log(`  KÄÄNNÖS  ${path}: kääntämätön tunniste näkyvissä`); problems++; }

      let flag = 'ok';
      if (newErrs.length) { flag = 'VIRHE'; problems++; }
      else if (denied) flag = 'estetty';
      else if (empty && !redirected) { flag = 'TYHJÄ'; problems++; }
      else if (redirected) { flag = 'ohjattu'; problems++; }

      console.log(`  ${flag.padEnd(7)} ${path.padEnd(18)} -> ${landed.padEnd(18)} ${body.slice(0, 62)}`);
      newErrs.forEach((e) => console.log(`          ${e}`));
    }
    await page.screenshot({ path: `${OUT}/pages-${r.role}.png`, fullPage: true });
  } catch (e) {
    console.log('  KAATUI:', String(e).split('\n')[0].slice(0, 140));
    problems++;
  } finally {
    await browser.close();
  }
}

console.log(`\nongelmia yhteensä: ${problems}`);
