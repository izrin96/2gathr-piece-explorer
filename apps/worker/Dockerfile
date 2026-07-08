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

COPY packages/lib packages/lib
COPY packages/db packages/db
COPY packages/2gathr packages/2gathr
COPY apps/worker apps/worker
WORKDIR /repo/apps/worker
USER node
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
