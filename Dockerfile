# Rutiini -- production image
#
# Multi-stage: the build stage needs the full toolchain, the runtime stage ships
# only production dependencies and the compiled output.

# ---- build ----------------------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Dependencies are installed from the lockfile first so this layer is reused
# whenever only application source has changed.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# tini reaps zombie processes and forwards signals, so the container stops
# cleanly instead of waiting for the orchestrator to kill it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Drizzle needs the schema and its config to run `npm run db:push` from inside
# the container when setting up a new database.
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/scripts/add-indexes.sql ./scripts/add-indexes.sql

# Never run as root: a container breakout should not land on uid 0.
USER node

EXPOSE 5000

# The app serves /api/health, which reports database connectivity as well as
# process liveness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
