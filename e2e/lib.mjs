import { chromium } from 'playwright';

export const BASE = process.env.E2E_BASE || 'http://localhost:5100';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Noise that is environment, not application: this sandbox has no outbound network. */
const IGNORED = [/fonts\.googleapis/, /ERR_CONNECTION_RESET/, /React DevTools/];

export async function newSession() {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  const note = (kind, text) => {
    if (!IGNORED.some((r) => r.test(text))) errors.push(`[${kind}] ${text.slice(0, 160)}`);
  };
  page.on('console', (m) => { if (m.type() === 'error') note('console', m.text()); });
  page.on('pageerror', (e) => note('pageerror', String(e)));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) {
      note('http', `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  return { browser, page, errors };
}

export const text = async (page) =>
  (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 500);

export const testids = async (page) => {
  const out = [];
  for (const el of await page.locator('[data-testid]').all()) out.push(await el.getAttribute('data-testid'));
  return out.filter(Boolean);
};

/**
 * Municipality -> daycare -> role -> credentials.
 *
 * `password` may be a list. The first sign-in for an account is required to change
 * its password, so an account is only on the seeded password until some script has
 * used it: running two scripts in one pass (which `run.sh` does by default -- the
 * database is reset per run, not per script) left the later one signing in with a
 * password that no longer existed. It got a 401, carried on unauthenticated, and
 * every page it then checked was reported as a fault of the page. Passing both the
 * seeded and the rotated password makes a script work whether or not it is first.
 */
export async function signIn(page, { daycare, role, email, password, municipality = 'Helsinki' }) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByTestId('select-municipality').click();
  await page.waitForTimeout(400);
  await page.locator('[role=option]').filter({ hasText: municipality }).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId(`option-daycare-${daycare}`).click();
  await page.waitForTimeout(300);
  await page.getByTestId('button-continue').click();
  await page.waitForTimeout(900);
  await page.getByTestId(`button-login-${role}`).click();
  await page.waitForTimeout(900);

  const candidates = Array.isArray(password) ? password : [password];
  for (const candidate of candidates) {
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill(candidate);
    await page.getByTestId('button-login').click();
    await page.waitForTimeout(2200);
    // The form is replaced on success, so its absence is what "signed in" looks like.
    if ((await page.getByTestId('input-email').count()) === 0) break;
  }

  return page.url();
}

/** New accounts carry passwordNeedsReset, so the first sign-in lands here. */
export async function changePasswordIfPrompted(page, current, next) {
  if (!page.url().includes('/change-password')) return false;
  await page.getByTestId('input-current-password').fill(current);
  await page.getByTestId('input-new-password').fill(next);
  await page.getByTestId('input-confirm-password').fill(next);
  await page.getByTestId('button-change-password').click();
  await page.waitForTimeout(2500);
  return true;
}
