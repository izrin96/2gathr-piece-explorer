# Build from the repo root: docker build -f apps/website/Dockerfile .
FROM node:24-slim AS base
# Optional native deps pulled in transitively (bufferutil/utf-8-validate via
# ws) compile from source on install — need a C++ toolchain or install fails.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.10.0
WORKDIR /repo

# Workspace manifests only, so dependency layers cache across source changes.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/indexer/package.json apps/indexer/
COPY apps/worker/package.json apps/worker/
COPY apps/website/package.json apps/website/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/lint/package.json packages/lint/
COPY packages/lib/package.json packages/lib/
COPY packages/db/package.json packages/db/
COPY packages/2gathr/package.json packages/2gathr/

FROM manifests AS build
RUN pnpm install --frozen-lockfile --filter website...
COPY packages/tsconfig packages/tsconfig
COPY packages/lint packages/lint
COPY packages/lib packages/lib
COPY packages/db packages/db
COPY packages/2gathr packages/2gathr
COPY apps/website apps/website
# DATABASE_URL/INDEXER_DATABASE_URL aren't needed here — SSR loaders run at
# request time, not build time, and `pg` connects lazily.
RUN pnpm --filter website build

# Nitro's node-server output (apps/website/.output) is a standalone bundle
# (its own node_modules, no workspace/pnpm needed) — a fresh minimal image runs it.
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /repo/apps/website
COPY --from=build /repo/apps/website/.output .output
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
