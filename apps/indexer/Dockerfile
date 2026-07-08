# Build from the repo root: docker build -f apps/indexer/Dockerfile .
FROM node:24-slim AS base
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

FROM manifests AS runtime
ENV NODE_ENV=production
RUN pnpm install --prod --frozen-lockfile --filter indexer...
COPY apps/indexer/db apps/indexer/db
COPY --from=build /repo/apps/indexer/lib apps/indexer/lib
WORKDIR /repo/apps/indexer
USER node
# Apply pending TypeORM migrations (reads DB_URL), then start the processor.
CMD ["sh", "-c", "pnpm exec squid-typeorm-migration apply && node lib/main.js"]
