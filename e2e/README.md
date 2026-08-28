# End-to-end checks

Drives the real application in a browser: signs in as each role, walks every
authenticated page, and reports anything that errors, renders empty, redirects
unexpectedly, or leaks an untranslated identifier onto the screen.

```bash
./e2e/run.sh                # every script
./e2e/run.sh pages.mjs      # one script
E2E_ROLE=guardian ./e2e/run.sh pages.mjs   # one role
```

`run.sh` resets the database, seeds it, starts the app, runs the scripts and
stops the app. Each run starts from the same state, which matters because the
first sign-in forces a password change and so mutates the seeded data.

Requires a reachable PostgreSQL (`E2E_ADMIN_URL`, default
`postgres://rutiini:rutiini@localhost:5432/postgres`) and Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

| file | what it covers |
|---|---|
| `lib.mjs` | browser setup, error collection, the sign-in and password-change flows |
| `journeys.mjs` | sign-in per role, then clicking through the sidebar |
| `sidebar.mjs` | that the sidebar survives being used: it stays put on a desktop, and the drawer closes on a phone |
| `pages.mjs` | every authenticated route per role, checking what actually renders |
| `mobile.mjs` | the same routes at phone size, looking for anything that pushes the page wider than the screen |
| `writes.mjs` | the write actions: adding a child, logging an entry, sending a message, reporting an absence |
| `superadmin.mjs` | the super admin's own pages, and that the personal-data screens stay closed to it |
| `reset.mjs` | password reset from the request through the emailed link to signing in again |
| `export-check.mjs` | the four CSV report downloads, which used to answer 401 because the buttons navigated without the session |
| `export-injection.mjs` | that a child named like a spreadsheet formula is exported as text, not as something Excel would run |

These are not part of `npx vitest run`: they need a database and a browser, so
they are run deliberately rather than on every commit.

Run one invocation at a time. `run.sh` resets the database and stops any running
server before it starts, so two runs at once kill each other's server -- the
symptom is `ERR_CONNECTION_REFUSED` in the middle of an otherwise healthy run.

Several scripts may be passed to one invocation. The database is reset once per
run rather than once per script, so an account that an earlier script has already
used is past its mandatory first password change; `signIn` therefore accepts a
list of passwords and tries the seeded one before the rotated one. A script that
signs in as a new account should pass both for the same reason.
