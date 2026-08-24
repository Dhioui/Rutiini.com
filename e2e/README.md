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
| `pages.mjs` | every authenticated route per role, checking what actually renders |
| `writes.mjs` | the write actions: adding a child, logging an entry, sending a message, reporting an absence |
| `superadmin.mjs` | the super admin's own pages, and that the personal-data screens stay closed to it |
| `reset.mjs` | password reset from the request through the emailed link to signing in again |
| `export-check.mjs` | the four CSV report downloads, which used to answer 401 because the buttons navigated without the session |

These are not part of `npx vitest run`: they need a database and a browser, so
they are run deliberately rather than on every commit.

Run one script at a time. `run.sh` resets the database and stops any running
server before it starts, so two runs at once kill each other's server -- the
symptom is `ERR_CONNECTION_REFUSED` in the middle of an otherwise healthy run.
Passing several scripts to one invocation is also not the same as running them
separately: `journeys.mjs` performs the mandatory first password change, so a
later script signing in with the seeded password will be rejected.
