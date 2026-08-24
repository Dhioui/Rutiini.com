#!/usr/bin/env node
/**
 * Build the web assets for a native app bundle, then sync them into iOS and Android.
 *
 * This exists because `npm run build` alone is not enough for a phone. The browser
 * client is served by the API process and talks to it over relative paths; a native
 * build has no such server, so it has to be told the deployment's public address at
 * build time. Get that wrong and the app installs, opens, shows the login screen and
 * then fails every single request -- which looks like a broken product, not a
 * misconfigured build. So the address is required here rather than assumed.
 */

import { spawnSync } from 'node:child_process';

const url = (process.env.VITE_API_URL ?? '').trim();

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!url) {
  fail(
    'VITE_API_URL is not set.\n\n' +
      '  A phone cannot reach the server unless the app is told where it is:\n\n' +
      '      VITE_API_URL=https://your-server.fi npm run build:mobile\n',
  );
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(`VITE_API_URL is not a valid address: ${url}`);
}

if (parsed.protocol !== 'https:') {
  fail(
    `VITE_API_URL must be https, got ${parsed.protocol}//\n\n` +
      '  iOS blocks plain HTTP by default and so does Android, so an http address\n' +
      '  produces an app whose every request fails on a real device.',
  );
}

if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  fail(
    `VITE_API_URL points at ${parsed.hostname}, which on a phone means the phone itself.\n\n` +
      '  Use the address the deployment is actually reachable at.',
  );
}

const run = (command, args) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`Building the mobile bundle against ${parsed.origin}`);
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync']);

console.log(`\nDone. The app bundle will talk to ${parsed.origin}.`);
console.log('Open android/ in Android Studio or ios/App/App.xcworkspace in Xcode to build.\n');
