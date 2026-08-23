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

These are not part of `npx vitest run`: they need a database and a browser, so
they are run deliberately rather than on every commit.
