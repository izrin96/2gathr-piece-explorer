# Build from the repo root: docker build -f apps/worker/Dockerfile .
# The worker runs TypeScript directly via tsx: its workspace deps
# (@repo/db, @repo/lib, @repo/2gathr) export raw .ts sources.
FROM node:24-slim
RUN npm install -g pnpm@11.10.0
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/indexer/package.json apps/indexer/
COPY apps/worker/package.json apps/worker/
COPY apps/website/package.json apps/website/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/lint/package.json packages/lint/
COPY packages/lib/package.json packages/lib/
COPY packages/db/package.json packages/db/
COPY packages/2gathr/package.json packages/2gathr/
RUN pnpm install --prod --frozen-lockfile --filter worker...

COPY packages/tsconfig packages/tsconfig
COPY packages/lib packages/lib
COPY packages/db packages/db
COPY packages/2gathr packages/2gathr
COPY apps/worker apps/worker
WORKDIR /repo/apps/worker
USER node
# Apply pending Drizzle migrations against MIGRATE_DATABASE_URL (direct
# Postgres, never pgbouncer — DDL breaks under transaction pooling), then
# start. drizzle-kit is a dependency of *this* package, not @repo/db (pnpm's
# per-package node_modules means @repo/db's own `db:migrate` script can't see
# it, and adding it to @repo/db would drag its native-dep weight into the
# website/indexer images too) — invoke the binary directly, but cwd must be
# packages/db since drizzle-kit resolves the config's relative schema/out
# paths against cwd, not the --config file's location.
CMD ["sh", "-c", "cd /repo/packages/db && DATABASE_URL=\"$MIGRATE_DATABASE_URL\" /repo/apps/worker/node_modules/.bin/drizzle-kit migrate --config /repo/packages/db/drizzle.config.ts && cd /repo/apps/worker && pnpm exec tsx src/index.ts"]
