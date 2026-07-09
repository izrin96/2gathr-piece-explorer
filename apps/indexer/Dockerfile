# Build from the repo root: docker build -f apps/indexer/Dockerfile .
FROM node:24-slim AS base
# bufferutil (native) is a hard dependency of `websocket`, pulled in by
# @subsquid/rpc-client (evm-processor's RPC transport) — a real prod dep, not
# optional, so this toolchain is unavoidable for both build and prod-deps below.
# It never reaches the final image: `runtime` starts fresh off node:24-slim.
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
RUN pnpm install --frozen-lockfile --filter indexer...
COPY packages/tsconfig packages/tsconfig
COPY apps/indexer apps/indexer
RUN pnpm --filter indexer build

FROM manifests AS prod-deps
RUN pnpm install --prod --frozen-lockfile --filter indexer...

# Fresh minimal base — deliberately not built on top of `manifests`/`build` so
# no toolchain, apt cache, or dev deps leak into the shipped image (this cut
# the image from ~825MB to ~300MB).
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo /repo
COPY apps/indexer/db apps/indexer/db
COPY --from=build /repo/apps/indexer/lib apps/indexer/lib
WORKDIR /repo/apps/indexer
USER node
# Apply pending TypeORM migrations (reads DB_URL), then start the processor.
# Invoke the binary directly — no pnpm needed at runtime, so it's not installed here.
CMD ["sh", "-c", "./node_modules/.bin/squid-typeorm-migration apply && node lib/main.js"]
