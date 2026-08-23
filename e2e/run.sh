#!/usr/bin/env bash
#
# End-to-end run: reset the database, start the app, drive it in a real browser,
# then stop the app. Every run starts from the same seeded state, so journeys that
# change data (a password change is mandatory on first sign-in) stay repeatable.
#
#   ./e2e/run.sh                 # every journey
#   ./e2e/run.sh pages.mjs       # one script
#
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-5100}"
DB="${E2E_DB:-rutiini_e2e}"
ADMIN_URL="${E2E_ADMIN_URL:-postgres://rutiini:rutiini@localhost:5432/postgres}"
export DATABASE_URL="${E2E_DATABASE_URL:-postgres://rutiini:rutiini@localhost:5432/$DB}"
export E2E_BASE="http://localhost:$PORT"
export JWT_SECRET="${JWT_SECRET:-e2e-secret-long-enough-to-pass-the-production-check}"
export PORT NODE_ENV=development

SCRIPTS=("${@:-journeys.mjs pages.mjs}")

stop_servers() {
  # reusePort lets several processes share the port: two would each run their own
  # Vite instance and the browser would get halves of two different dependency
  # builds. Make sure exactly one is running.
  ps -eo pid,cmd | grep "[s]erver/index.ts" | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true
  sleep 2
}

echo "== nollataan kanta: $DB"
stop_servers
psql "$ADMIN_URL" -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid<>pg_backend_pid();" >/dev/null
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $DB;"
psql "$ADMIN_URL" -q -c "CREATE DATABASE $DB OWNER rutiini;"
npm run db:push -- --force >/dev/null 2>&1
npx tsx server/seed.ts >/dev/null 2>&1

echo "== käynnistetään sovellus portissa $PORT"
npx tsx server/index.ts > /tmp/e2e-server.log 2>&1 &
SERVER_PID=$!
trap 'kill -9 $SERVER_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -fsS --max-time 2 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://localhost:$PORT/api/health" >/dev/null || { echo "sovellus ei käynnistynyt"; tail -20 /tmp/e2e-server.log; exit 1; }

mkdir -p /tmp/e2e-shots
status=0
for s in ${SCRIPTS[@]}; do
  echo
  echo "== $s"
  node "e2e/$s" /tmp/e2e-shots || status=1
done
exit $status
