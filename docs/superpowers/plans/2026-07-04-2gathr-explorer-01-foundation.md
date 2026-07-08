# 2GATHR Explorer — Plan 1: Monorepo Foundation (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm + Turborepo monorepo skeleton, shared config packages, the two-database Postgres/Valkey dev stack, and the HTTP-inspection findings needed before building the indexer.

**Architecture:** A pnpm-workspace monorepo (`apps/*`, `packages/*`) orchestrated by Turborepo, linted by oxlint and formatted by oxfmt. Shared packages provide TypeScript configs (`@repo/tsconfig`), lint config (`@repo/lint`), pure utilities + domain types (`@repo/lib`), Drizzle schema/clients for two databases (`@repo/db`), and a stub 2gathr/TopPort API client (`@repo/2gathr`). A docker-compose stack runs two Postgres 18 databases (app `main` + Subsquid-owned `indexer`), pgbouncer poolers, and Valkey. Vitest is the test runner.

**Tech Stack:** pnpm 11 (workspaces + catalogs), Turborepo, TypeScript 7 rc, oxlint + oxfmt, Drizzle ORM 1.0-rc (`node-postgres`), drizzle-kit, Postgres 18, pgbouncer, Valkey, Vitest, ofetch, zod, Docker Compose.

## Global Constraints

- Package manager: **pnpm@11** (root `packageManager` field; use `pnpm` for every command, never npm/yarn/bun).
- Node runtime (no Bun). TypeScript **7.x rc** (`catalog:dev`).
- Shared dependency versions come from pnpm **catalogs** — packages reference `catalog:` / `catalog:dev`, never pin versions directly.
- Internal package names: `@repo/tsconfig`, `@repo/lint`, `@repo/lib`, `@repo/db`, `@repo/2gathr`. Internal deps use `workspace:*`.
- Lint = `oxlint --type-aware`; format = `oxfmt`. Every package/app exposes `lint`, `lint:fix`, `typecheck`, `format`, and (where it has code) `test` scripts.
- oxfmt: printWidth 100, 2-space, double quotes, semicolons, trailing-comma all, natural import sort.
- Two databases: app `DATABASE_URL` (db `main`) and `INDEXER_DATABASE_URL` (db `indexer`, owned by Subsquid; read-only from app/worker). Never write indexer tables from app/worker.
- On-chain facts (from the spec, for later tasks): Titan L1 `chainId 84358`, RPC `https://subnets.avax.network/titan/mainnet/rpc`, `eth_getLogs` cap **2048 blocks**, no Subsquid archive. Ruby ERC-20 `0x16ac90358d5f8610a85fa5270659356afdc48a9e`. Piece = many ERC-721 contracts; metadata per-design on IPFS; serial = tokenId.
- Commit after every task with a Conventional Commit message.

---

### Task 1: Root workspace scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `oxfmt.config.ts`
- Create: `.npmrc`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `.gitignore` (already exists from spec commit — verify entries)

**Interfaces:**

- Produces: pnpm catalogs `drizzle-orm`, `pg`, `zod`, `ofetch` (in `catalog:`) and `typescript`, `turbo`, `drizzle-kit`, `@types/node`, `@types/pg`, `oxlint`, `oxfmt`, `vitest` (in `catalog:dev` / root devDeps). Turbo tasks `dev|build|start|lint|lint:fix|typecheck|format|test`.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  drizzle-orm: ^1.0.0-rc.4-5d5b77c
  pg: ^8.22.0
  zod: ^4.4.3
  ofetch: ^1.5.1

catalogs:
  dev:
    typescript: ^7.0.1-rc
    turbo: ^2.10.2
    drizzle-kit: ^1.0.0-rc.4-5d5b77c
    "@types/node": ^26.0.1
    "@types/pg": ^8.20.0
    vitest: ^3.2.4
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "2gathr-nft-tracker",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "start": "turbo run start",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt .",
    "test": "turbo run test"
  },
  "devDependencies": {
    "@types/node": "catalog:dev",
    "oxfmt": "^0.57.0",
    "oxlint": "^1.72.0",
    "oxlint-tsgolint": "^0.23.0",
    "turbo": "catalog:dev",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "globalDependencies": ["packages/lint/oxlint.config.ts", "oxfmt.config.ts"],
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".output/**", "lib/**"] },
    "start": { "cache": false, "persistent": true },
    "lint": {
      "dependsOn": ["^lint"],
      "inputs": ["$TURBO_DEFAULT$", "oxlint.config.ts"],
      "outputs": []
    },
    "lint:fix": {
      "inputs": ["$TURBO_DEFAULT$", "oxlint.config.ts"],
      "outputs": ["**/*.{ts,tsx,js,jsx}"],
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "inputs": ["$TURBO_DEFAULT$", "tsconfig.json"],
      "outputs": []
    },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "format": { "inputs": ["$TURBO_DEFAULT$", "oxfmt.config.ts"], "outputs": [], "cache": false }
  }
}
```

- [ ] **Step 4: Create `oxfmt.config.ts`**

```typescript
import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  sortTailwindcss: {
    attributes: ["classList"],
    functions: ["twMerge", "twJoin", "tv", "composeRenderProps", "composeTailwindRenderProps"],
  },
  sortImports: { type: "natural" },
  ignorePatterns: ["node_modules", "*.gen.ts", "src/paraglide", "src/model/generated"],
});
```

- [ ] **Step 5: Create `.npmrc`**

```
link-workspace-packages=true
prefer-workspace-packages=true
```

- [ ] **Step 6: Create root `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 7: Create `.env.example`**

```
# ---- app database (main) ----
DATABASE_URL="postgres://postgres:postgres@localhost:5433/main"
# ---- indexer database (owned by Subsquid) ----
INDEXER_DATABASE_URL="postgres://postgres:postgres@localhost:5435/indexer"

# ---- cache / queue ----
REDIS_URL="redis://localhost:6379"

# ---- media storage (worker mirrors IPFS + TopPort thumbnails here) ----
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=auto
S3_BUCKET=
S3_PUBLIC_URL=

# ---- website ----
VITE_SITE_URL="http://localhost:3000"

# ---- indexer (Titan L1, RPC-only; no archive) ----
INDEXER_RPC_ENDPOINT="https://subnets.avax.network/titan/mainnet/rpc"
INDEXER_RPC_RATE_LIMIT=5
INDEXER_RPC_FINALITY=10
INDEXER_START_BLOCK=0
INDEXER_GETLOGS_RANGE=2048
INDEXER_RUBY_ADDRESS="0x16ac90358d5f8610a85fa5270659356afdc48a9e"
INDEXER_FORCE_PRETTY_LOGGER=1
```

- [ ] **Step 8: Verify `.gitignore` covers pnpm/turbo/node**

Confirm it contains `node_modules/`, `dist/`, `.output/`, `.turbo/`, `lib/`, `.env`, `!.env.example`. Add any missing line. (File already created during brainstorming commit.)

- [ ] **Step 9: Install and verify tooling resolves**

Run: `pnpm install`
Expected: completes without error; creates `pnpm-lock.yaml`.

Run: `pnpm turbo --version`
Expected: prints a `2.x` version.

Run: `pnpm exec oxfmt --version && pnpm exec oxlint --version`
Expected: both print versions.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json oxfmt.config.ts .npmrc vitest.config.ts .env.example .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm + turborepo workspace"
```

---

### Task 2: `@repo/tsconfig` package

**Files:**

- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/tsconfig.base.json`
- Create: `packages/tsconfig/tsconfig.node.json`
- Create: `packages/tsconfig/tsconfig.react.json`

**Interfaces:**

- Produces: exports `@repo/tsconfig/tsconfig.base.json`, `/tsconfig.node.json`, `/tsconfig.react.json`. Consumed by every package/app's `tsconfig.json` via `"extends"`.

- [ ] **Step 1: Create `packages/tsconfig/package.json`**

```json
{
  "name": "@repo/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["tsconfig.base.json", "tsconfig.node.json", "tsconfig.react.json"],
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.node.json": "./tsconfig.node.json",
    "./tsconfig.react.json": "./tsconfig.react.json"
  }
}
```

- [ ] **Step 2: Create `packages/tsconfig/tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "esnext",
    "lib": ["ESNext"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", "dist", ".turbo"]
}
```

- [ ] **Step 3: Create `packages/tsconfig/tsconfig.node.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Create `packages/tsconfig/tsconfig.react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"]
  }
}
```

- [ ] **Step 5: Verify install picks up the package**

Run: `pnpm install`
Expected: `@repo/tsconfig` appears as a workspace package (no error).

- [ ] **Step 6: Commit**

```bash
git add packages/tsconfig
git commit -m "chore: add @repo/tsconfig shared TypeScript configs"
```

---

### Task 3: `@repo/lint` package

**Files:**

- Create: `packages/lint/package.json`
- Create: `packages/lint/oxlint.config.ts`

**Interfaces:**

- Produces: export `@repo/lint/oxlint.config`. Each app/package's `oxlint.config.ts` re-exports it.

- [ ] **Step 1: Create `packages/lint/package.json`**

```json
{
  "name": "@repo/lint",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./oxlint.config": "./oxlint.config.ts" }
}
```

- [ ] **Step 2: Create `packages/lint/oxlint.config.ts`**

```typescript
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["react", "import"],
  options: { typeAware: true },
  rules: {
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "off",
    "react/jsx-key": "warn",
    "eslint/no-unused-vars": "off",
    "typescript/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
    "typescript/unbound-method": "off",
    "typescript/restrict-template-expressions": "off",
    "import/no-duplicates": "error",
  },
});
```

- [ ] **Step 3: Verify config loads**

Run: `pnpm exec oxlint --config packages/lint/oxlint.config.ts packages/lint`
Expected: runs and reports "Found 0 warnings and 0 errors" (or similar clean result).

- [ ] **Step 4: Commit**

```bash
git add packages/lint
git commit -m "chore: add @repo/lint shared oxlint config"
```

---

### Task 4: `@repo/lib` — shared utilities + domain types (TDD)

**Files:**

- Create: `packages/lib/package.json`
- Create: `packages/lib/tsconfig.json`
- Create: `packages/lib/oxlint.config.ts`
- Create: `packages/lib/vitest.config.ts`
- Create: `packages/lib/src/index.ts`
- Create: `packages/lib/src/address.ts`
- Create: `packages/lib/src/address.test.ts`
- Create: `packages/lib/src/piece.ts`
- Create: `packages/lib/src/piece.test.ts`

**Interfaces:**

- Produces:
  - `normalizeAddress(addr: string): string` — lowercased, validated `0x`+40 hex; throws `Error` on invalid.
  - `isAddress(addr: string): boolean`.
  - `ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"`.
  - `type PieceEdition = "2025 Season 1" | "2026 Season 1" | "2026 Season 2" | "2026 Season 3" | "2026 HBD" | "Welcome" | "Hidden Piece" | "Unknown"`.
  - `classifyEdition(contractName: string): PieceEdition` — maps a contract `name()` to a `PieceEdition`.
  - `parsePieceName(name: string): { member: string | null; designNumber: number | null; hidden: boolean }` — parses token metadata `name` like `"NAHYUN #001"` / `"SEOHYEON (Hidden) #001"` / `"Welcome to 2GATHR"`.

- [ ] **Step 1: Create `packages/lib/package.json`**

```json
{
  "name": "@repo/lib",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./*": "./src/*.ts" },
  "scripts": {
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
    "typecheck": "tsc --noEmit",
    "format": "oxfmt .",
    "test": "vitest run"
  },
  "devDependencies": {
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 2: Create `packages/lib/tsconfig.json`**

```json
{
  "extends": "@repo/tsconfig/tsconfig.node.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/lib/oxlint.config.ts`**

```typescript
import config from "@repo/lint/oxlint.config";

export default config;
```

- [ ] **Step 4: Create `packages/lib/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 5: Write the failing test `packages/lib/src/address.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { isAddress, normalizeAddress, ZERO_ADDRESS } from "./address";

describe("normalizeAddress", () => {
  it("lowercases a valid checksummed address", () => {
    expect(normalizeAddress("0x16AC90358D5f8610A85FA5270659356AFDC48A9E")).toBe(
      "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
    );
  });

  it("throws on an invalid address", () => {
    expect(() => normalizeAddress("0x123")).toThrow();
  });
});

describe("isAddress", () => {
  it("returns true for a 42-char hex address", () => {
    expect(isAddress("0x16ac90358d5f8610a85fa5270659356afdc48a9e")).toBe(true);
  });

  it("returns false for garbage", () => {
    expect(isAddress("nope")).toBe(false);
  });
});

it("exposes the zero address", () => {
  expect(ZERO_ADDRESS).toBe("0x0000000000000000000000000000000000000000");
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter @repo/lib test`
Expected: FAIL — cannot resolve `./address`.

- [ ] **Step 7: Implement `packages/lib/src/address.ts`**

```typescript
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isAddress(addr: string): boolean {
  return ADDRESS_RE.test(addr);
}

export function normalizeAddress(addr: string): string {
  if (!isAddress(addr)) {
    throw new Error(`Invalid EVM address: ${addr}`);
  }
  return addr.toLowerCase();
}
```

- [ ] **Step 8: Run the address test to verify it passes**

Run: `pnpm --filter @repo/lib test`
Expected: address tests PASS (piece test not yet added).

- [ ] **Step 9: Write the failing test `packages/lib/src/piece.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { classifyEdition, parsePieceName } from "./piece";

describe("classifyEdition", () => {
  it("maps known contract names to editions", () => {
    expect(classifyEdition("2025 Season 1")).toBe("2025 Season 1");
    expect(classifyEdition("2026 HBD")).toBe("2026 HBD");
    expect(classifyEdition("Hidden Piece")).toBe("Hidden Piece");
    expect(classifyEdition("Welcome")).toBe("Welcome");
  });

  it("falls back to Unknown", () => {
    expect(classifyEdition("Something Else")).toBe("Unknown");
  });
});

describe("parsePieceName", () => {
  it("parses a standard piece name", () => {
    expect(parsePieceName("NAHYUN #001")).toEqual({
      member: "NAHYUN",
      designNumber: 1,
      hidden: false,
    });
  });

  it("parses a hidden piece name", () => {
    expect(parsePieceName("SEOHYEON (Hidden) #001")).toEqual({
      member: "SEOHYEON",
      designNumber: 1,
      hidden: true,
    });
  });

  it("returns nulls for a non-member piece", () => {
    expect(parsePieceName("Welcome to 2GATHR")).toEqual({
      member: null,
      designNumber: null,
      hidden: false,
    });
  });
});
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm --filter @repo/lib test`
Expected: FAIL — cannot resolve `./piece`.

- [ ] **Step 11: Implement `packages/lib/src/piece.ts`**

```typescript
export type PieceEdition =
  | "2025 Season 1"
  | "2026 Season 1"
  | "2026 Season 2"
  | "2026 Season 3"
  | "2026 HBD"
  | "Welcome"
  | "Hidden Piece"
  | "Unknown";

const KNOWN_EDITIONS: PieceEdition[] = [
  "2025 Season 1",
  "2026 Season 1",
  "2026 Season 2",
  "2026 Season 3",
  "2026 HBD",
  "Welcome",
  "Hidden Piece",
];

export function classifyEdition(contractName: string): PieceEdition {
  const match = KNOWN_EDITIONS.find((e) => e === contractName.trim());
  return match ?? "Unknown";
}

const PIECE_NAME_RE = /^(?<member>[A-Za-z]+)(?:\s*\((?<hidden>Hidden)\))?\s*#(?<num>\d+)$/;

export function parsePieceName(name: string): {
  member: string | null;
  designNumber: number | null;
  hidden: boolean;
} {
  const m = PIECE_NAME_RE.exec(name.trim());
  if (!m?.groups) {
    return { member: null, designNumber: null, hidden: false };
  }
  return {
    member: m.groups.member ?? null,
    designNumber: m.groups.num ? Number.parseInt(m.groups.num, 10) : null,
    hidden: m.groups.hidden === "Hidden",
  };
}
```

- [ ] **Step 12: Create `packages/lib/src/index.ts`**

```typescript
export * from "./address";
export * from "./piece";
```

- [ ] **Step 13: Run tests + typecheck to verify all pass**

Run: `pnpm --filter @repo/lib test && pnpm --filter @repo/lib typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 14: Commit**

```bash
git add packages/lib
git commit -m "feat(lib): add address + piece-name utilities with tests"
```

---

### Task 5: `@repo/db` — Drizzle clients, app schema, drizzle-kit configs (TDD for the pure parts)

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/oxlint.config.ts`
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/drizzle-indexer.config.ts`
- Create: `packages/db/src/custom-type.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/relation.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/indexer/schema.ts`
- Create: `packages/db/src/indexer/relation.ts`
- Create: `packages/db/src/indexer/index.ts`
- Create: `packages/db/src/schema.test.ts`

**Interfaces:**

- Consumes: `@repo/lib` (`PieceEdition` type reference in comments only).
- Produces:
  - `db` — Drizzle client for the app database (`DATABASE_URL`).
  - `indexer` — Drizzle client for the indexer database (`INDEXER_DATABASE_URL`, read-only usage).
  - App tables: `pieceDesignMeta`, `addressProfile`, `rollupStat`.
  - `citext(name, opts?)` custom column type.
  - `src/indexer/schema.ts` — **empty placeholder** now; filled by `drizzle-kit pull` after the Indexer plan creates Subsquid tables.
  - Scripts: `db:generate`, `db:push`, `db:migrate`, `db:studio`, `db:pull:indexer`, `db:studio:indexer`.

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./indexer": "./src/indexer/index.ts",
    "./schema": "./src/schema.ts",
    "./*": "./src/*.ts"
  },
  "scripts": {
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
    "typecheck": "tsc --noEmit",
    "format": "oxfmt .",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:pull:indexer": "drizzle-kit pull --config drizzle-indexer.config.ts",
    "db:studio:indexer": "drizzle-kit studio --config drizzle-indexer.config.ts"
  },
  "dependencies": {
    "@repo/lib": "workspace:*",
    "drizzle-orm": "catalog:",
    "pg": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "@types/pg": "catalog:dev",
    "drizzle-kit": "catalog:dev",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@repo/tsconfig/tsconfig.node.json",
  "include": ["src", "drizzle.config.ts", "drizzle-indexer.config.ts"]
}
```

- [ ] **Step 3: Create `packages/db/oxlint.config.ts`**

```typescript
import config from "@repo/lint/oxlint.config";

export default config;
```

- [ ] **Step 4: Create `packages/db/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 5: Create `packages/db/src/custom-type.ts`**

```typescript
import { customType } from "drizzle-orm/pg-core";

// Case-insensitive text, used for EVM addresses stored lowercase.
export const citext = customType<{ data: string; driverData: string; config: { length?: number } }>(
  {
    dataType(config) {
      return "citext";
    },
  },
);
```

- [ ] **Step 6: Create `packages/db/src/schema.ts`**

```typescript
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { citext } from "./custom-type";

// Worker-enriched Piece design metadata (from IPFS tokenURI), keyed by contract address.
export const pieceDesignMeta = pgTable(
  "piece_design_meta",
  {
    contractAddress: citext("contract_address", { length: 42 }).primaryKey(),
    member: text("member"),
    designNumber: integer("design_number"),
    edition: text("edition").notNull(),
    rarity: integer("rarity"),
    classLetter: text("class"),
    imageUrl: text("image_url"),
    thumbnailUrl: text("thumbnail_url"),
    animationUrl: text("animation_url"),
    mediaType: text("media_type"),
    isHidden: text("is_hidden"),
    rawMetadata: jsonb("raw_metadata"),
    fetchedAt: timestamp("fetched_at", { mode: "string", withTimezone: true }),
  },
  (t) => [index("piece_design_meta_member_idx").on(t.member)],
);

// Cached address -> 2gathr nickname + profile prefs.
export const addressProfile = pgTable("address_profile", {
  address: citext("address", { length: 42 }).primaryKey(),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  hiddenFromLeaderboard: text("hidden_from_leaderboard"),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }),
});

// Generic rollup cache (holder counts, class distribution, etc.), keyed by a string key.
export const rollupStat = pgTable(
  "rollup_stat",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] })],
);
```

- [ ] **Step 7: Create `packages/db/src/relation.ts`**

```typescript
import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

// No cross-table relations in Phase 1; expand as tables are added.
export const relations = defineRelations(schema, () => ({}));
```

- [ ] **Step 8: Create `packages/db/src/index.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relation";

export const db = drizzle(process.env.DATABASE_URL!, { relations });

export * as schema from "./schema";
```

- [ ] **Step 9: Create indexer placeholders**

`packages/db/src/indexer/schema.ts`:

```typescript
// Populated by `pnpm --filter @repo/db db:pull:indexer` after the Subsquid
// indexer creates its tables (piece_collection, piece_token, piece_transfer, ruby_transfer).
// Intentionally empty until then.
export {};
```

`packages/db/src/indexer/relation.ts`:

```typescript
import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, () => ({}));
```

`packages/db/src/indexer/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relation";

export const indexer = drizzle(process.env.INDEXER_DATABASE_URL!, { relations });
```

- [ ] **Step 10: Create `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 11: Create `packages/db/drizzle-indexer.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/indexer/schema.ts",
  out: "./indexer-migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.INDEXER_DATABASE_URL! },
});
```

- [ ] **Step 12: Write the failing test `packages/db/src/schema.test.ts`**

```typescript
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { addressProfile, pieceDesignMeta } from "./schema";

describe("app schema", () => {
  it("names the piece_design_meta table and keys it by contract address", () => {
    const cfg = getTableConfig(pieceDesignMeta);
    expect(cfg.name).toBe("piece_design_meta");
    const pk = cfg.columns.find((c) => c.primary);
    expect(pk?.name).toBe("contract_address");
  });

  it("names the address_profile table", () => {
    const cfg = getTableConfig(addressProfile);
    expect(cfg.name).toBe("address_profile");
  });
});
```

- [ ] **Step 13: Run to verify it fails, then install deps**

Run: `pnpm install`
Then run: `pnpm --filter @repo/db test`
Expected: PASS once deps are installed (this test exercises schema definitions, no DB needed). If it fails to resolve `drizzle-orm`, re-run `pnpm install` and retry.

- [ ] **Step 14: Typecheck**

Run: `pnpm --filter @repo/db typecheck`
Expected: exits 0.

- [ ] **Step 15: Commit**

```bash
git add packages/db
git commit -m "feat(db): add drizzle clients, app schema, and drizzle-kit configs"
```

---

### Task 6: `@repo/2gathr` — API client stub + metadata parser (TDD)

**Files:**

- Create: `packages/2gathr/package.json`
- Create: `packages/2gathr/tsconfig.json`
- Create: `packages/2gathr/oxlint.config.ts`
- Create: `packages/2gathr/vitest.config.ts`
- Create: `packages/2gathr/src/types/metadata.ts`
- Create: `packages/2gathr/src/metadata.ts`
- Create: `packages/2gathr/src/metadata.test.ts`
- Create: `packages/2gathr/src/http.ts`
- Create: `packages/2gathr/src/index.ts`

**Interfaces:**

- Consumes: `zod`, `ofetch`, `@repo/lib` (`parsePieceName`, `classifyEdition`).
- Produces:
  - `pieceMetadataSchema` (zod) validating the IPFS JSON shape.
  - `type PieceMetadata = z.infer<typeof pieceMetadataSchema>`.
  - `parsePieceMetadata(json: unknown): ParsedPieceDesign` where `ParsedPieceDesign = { member: string | null; designNumber: number | null; rarity: number; imageUrl: string; thumbnailUrl: string | null; animationUrl: string | null; mediaType: string; isHidden: boolean }`.
  - `createHttpClient(baseURL: string)` — an `ofetch` instance (used later for the private TopPort API once inspection confirms endpoints).

- [ ] **Step 1: Create `packages/2gathr/package.json`**

```json
{
  "name": "@repo/2gathr",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./*": "./src/*.ts" },
  "scripts": {
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
    "typecheck": "tsc --noEmit",
    "format": "oxfmt .",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/lib": "workspace:*",
    "ofetch": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 2: Create `packages/2gathr/tsconfig.json`**

```json
{
  "extends": "@repo/tsconfig/tsconfig.node.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/2gathr/oxlint.config.ts`**

```typescript
import config from "@repo/lint/oxlint.config";

export default config;
```

- [ ] **Step 4: Create `packages/2gathr/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 5: Create `packages/2gathr/src/types/metadata.ts`**

```typescript
import { z } from "zod";

export const pieceAttributeSchema = z.object({
  trait_type: z.string(),
  value: z.string(),
});

export const pieceMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  image: z.string().default(""),
  extension: z.string().optional().default(""),
  alt_url: z.string().optional().default(""),
  animation_url: z.string().optional().default(""),
  external_url: z.string().optional().default(""),
  rarity: z.number().default(0),
  attributes: z.array(pieceAttributeSchema).default([]),
});

export type PieceMetadata = z.infer<typeof pieceMetadataSchema>;
```

- [ ] **Step 6: Write the failing test `packages/2gathr/src/metadata.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { parsePieceMetadata } from "./metadata";

const NAHYUN = {
  name: "NAHYUN #001",
  description: "Take a look at the photo of the lovely AtHeart member NAHYUN !",
  image: "https://gateway.pinata.cloud/ipfs/bafyimg",
  extension: "png",
  alt_url: "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/x_NAHYUN%20%23001.jpeg",
  animation_url: "",
  rarity: 1,
  attributes: [
    { trait_type: "Artist", value: "AtHeart" },
    { trait_type: "Member", value: "Nahyun" },
    { trait_type: "Serial", value: "1" },
    { trait_type: "Type", value: "Image" },
  ],
};

const HIDDEN = {
  name: "SEOHYEON (Hidden) #001",
  image: "https://gateway.pinata.cloud/ipfs/bafyhidden",
  extension: "png",
  alt_url: "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/y_seohyeon.jpeg",
  rarity: 1,
  attributes: [
    { trait_type: "Member", value: "Seohyeon" },
    { trait_type: "Hidden", value: "True" },
  ],
};

describe("parsePieceMetadata", () => {
  it("parses a standard piece, preferring the Member attribute", () => {
    const r = parsePieceMetadata(NAHYUN);
    expect(r.member).toBe("Nahyun");
    expect(r.designNumber).toBe(1);
    expect(r.rarity).toBe(1);
    expect(r.mediaType).toBe("png");
    expect(r.isHidden).toBe(false);
    expect(r.imageUrl).toContain("ipfs/bafyimg");
    expect(r.thumbnailUrl).toContain("topport");
  });

  it("detects a hidden piece from attributes", () => {
    const r = parsePieceMetadata(HIDDEN);
    expect(r.member).toBe("Seohyeon");
    expect(r.isHidden).toBe(true);
  });

  it("throws on malformed metadata", () => {
    expect(() => parsePieceMetadata({ foo: "bar" })).toThrow();
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `pnpm --filter @repo/2gathr test`
Expected: FAIL — cannot resolve `./metadata`.

- [ ] **Step 8: Implement `packages/2gathr/src/metadata.ts`**

```typescript
import { parsePieceName } from "@repo/lib";

import { type PieceMetadata, pieceMetadataSchema } from "./types/metadata";

export interface ParsedPieceDesign {
  member: string | null;
  designNumber: number | null;
  rarity: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  animationUrl: string | null;
  mediaType: string;
  isHidden: boolean;
}

function attr(meta: PieceMetadata, trait: string): string | undefined {
  return meta.attributes.find((a) => a.trait_type === trait)?.value;
}

export function parsePieceMetadata(json: unknown): ParsedPieceDesign {
  const meta = pieceMetadataSchema.parse(json);
  const fromName = parsePieceName(meta.name);
  const memberAttr = attr(meta, "Member");
  const hiddenAttr = attr(meta, "Hidden");

  return {
    member: memberAttr ?? fromName.member,
    designNumber: fromName.designNumber,
    rarity: meta.rarity,
    imageUrl: meta.image,
    thumbnailUrl: meta.alt_url || null,
    animationUrl: meta.animation_url || null,
    mediaType: meta.extension || "",
    isHidden: hiddenAttr === "True" || fromName.hidden,
  };
}
```

- [ ] **Step 9: Create `packages/2gathr/src/http.ts`**

```typescript
import { ofetch } from "ofetch";

// Base client for the private 2gathr/TopPort API. Exact endpoints are confirmed
// via the HTTP-inspection task (Task 8) and wired up in a later phase.
export function createHttpClient(baseURL: string) {
  return ofetch.create({ baseURL, retry: 1, timeout: 15_000 });
}
```

- [ ] **Step 10: Create `packages/2gathr/src/index.ts`**

```typescript
export * from "./metadata";
export * from "./http";
export * from "./types/metadata";
```

- [ ] **Step 11: Run tests + typecheck**

Run: `pnpm --filter @repo/2gathr test && pnpm --filter @repo/2gathr typecheck`
Expected: all PASS; typecheck exits 0.

- [ ] **Step 12: Commit**

```bash
git add packages/2gathr
git commit -m "feat(2gathr): add IPFS metadata schema/parser and http client stub"
```

---

### Task 7: Docker Compose dev stack (two Postgres 18 + pgbouncer + Valkey)

**Files:**

- Create: `docker-compose.yml`

**Interfaces:**

- Produces running services: `postgres` (app `main`), `postgres-indexer` (`indexer`), `pgbouncer` (→ app, host `5433`), `pgbouncer-indexer` (→ indexer, host `5435`), `valkey` (host `6379`). Host ports match `.env.example` URLs.

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:18
    restart: always
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=main
    volumes:
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "5433:5432"
    environment:
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_HOST=postgres
      - DB_NAME=main
      - POOL_MODE=transaction
      - AUTH_TYPE=scram-sha-256
      - MAX_CLIENT_CONN=300
      - DEFAULT_POOL_SIZE=20
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost"]

  postgres-indexer:
    image: postgres:18
    restart: always
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=indexer
    volumes:
      - postgres-indexer-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d indexer -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgbouncer-indexer:
    image: edoburu/pgbouncer:latest
    restart: always
    depends_on:
      postgres-indexer:
        condition: service_healthy
    ports:
      - "5435:5432"
    environment:
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_HOST=postgres-indexer
      - DB_NAME=indexer
      - POOL_MODE=transaction
      - AUTH_TYPE=scram-sha-256
      - MAX_CLIENT_CONN=300
      - DEFAULT_POOL_SIZE=20
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost"]

  valkey:
    image: valkey/valkey:latest
    restart: always
    ports:
      - "6379:6379"

volumes:
  postgres-data:
  postgres-indexer-data:
```

- [ ] **Step 2: Start the databases + cache**

Run: `docker compose up -d postgres postgres-indexer valkey`
Expected: three containers start.

- [ ] **Step 3: Verify health**

Run: `docker compose ps`
Expected: `postgres` and `postgres-indexer` show `healthy`; `valkey` shows `running`.

Run: `docker compose exec postgres psql -U postgres -d main -c "select 1;"`
Expected: returns a single row `1`.

- [ ] **Step 4: Enable the citext extension in the app database**

Run: `docker compose exec postgres psql -U postgres -d main -c "create extension if not exists citext;"`
Expected: `CREATE EXTENSION` (or notice that it already exists).

- [ ] **Step 5: Push the app schema to verify end-to-end wiring**

Create `.env` from `.env.example` first (fill nothing else needed for this step):

Run: `cp .env.example .env`
Run: `pnpm --filter @repo/db exec dotenvx run -f ../../.env -- true 2>/dev/null; DATABASE_URL="postgres://postgres:postgres@localhost:5433/main" pnpm --filter @repo/db db:push`

> If `dotenvx` is not present, ignore the first sub-command; the inline `DATABASE_URL=` is what matters. Prefer the explicit env var to avoid depending on any env loader in this task.

Expected: drizzle-kit reports creating `piece_design_meta`, `address_profile`, `rollup_stat`.

Run: `docker compose exec postgres psql -U postgres -d main -c "\dt"`
Expected: the three tables are listed.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose dev stack (postgres x2 + pgbouncer + valkey)"
```

---

### Task 8: HTTP-inspection discovery — 2gathr/TopPort private API

> **Note:** This is a discovery task, not a TDD task. Its deliverable is a findings document that the Indexer and later plans depend on. Do not block the Foundation on completeness here — capture what traffic is available and record gaps.

**Files:**

- Create: `docs/superpowers/research/2gathr-api-findings.md`

**Interfaces:**

- Produces: documented answers (or explicit "unknown") for: address→nickname endpoint, Piece Book definitions endpoint, class (`rarity` int → letter) mapping, and any auth scheme. Consumed by the Website (nickname routes) and Worker (class mapping) plans.

- [ ] **Step 1: Confirm the capture proxy is reachable**

The user runs mitmproxy web at `http://127.0.0.1:8081/` and generates traffic by using the 2gathr mobile app (browse Pieces, open a collection, open a profile, view Heart/Ruby, open Piece Book).

Use the **agent-browser** skill to drive the user's Chrome to `http://127.0.0.1:8081/` and read captured flows. Announce: "Using agent-browser to read captured 2gathr API flows."

- [ ] **Step 2: Identify the API host(s)**

From captured flows, record the base host(s) (likely a TopPort / 2gathr API domain and `topport.s3.ap-northeast-2.amazonaws.com` for media). Note request headers / auth (bearer token? session cookie?).

- [ ] **Step 3: Capture the key endpoints**

For each, record method, path, query params, and a trimmed example response:

- Wallet/owner → nickname (the "Shah189" mapping seen on a token detail).
- Piece Book list + a single Piece Book's required designs + hidden-piece reward.
- Any endpoint returning a Piece's class as a letter (to map `rarity` int → letter).
- Any collection/piece listing endpoint (may let us cross-check on-chain data).

- [ ] **Step 4: Write `docs/superpowers/research/2gathr-api-findings.md`**

Structure: `## Hosts & auth`, `## Nickname resolution`, `## Piece Book`, `## Class mapping`, `## Other useful endpoints`, `## Gaps / still unknown`. Paste real request/response examples (redact any personal tokens).

- [ ] **Step 5: Record the class mapping in code if determined**

If the `rarity` int → letter mapping is confirmed, add it to `@repo/lib`:

Create `packages/lib/src/class.ts`:

```typescript
// Confirmed via HTTP inspection (see docs/superpowers/research/2gathr-api-findings.md).
// Update the mapping below with the confirmed values.
const RARITY_TO_LETTER: Record<number, string> = {
  // e.g. 1: "A", 2: "B", 3: "C"  -- fill from findings
};

export function classLetter(rarity: number): string | null {
  return RARITY_TO_LETTER[rarity] ?? null;
}
```

Add `export * from "./class";` to `packages/lib/src/index.ts`. If the mapping is **not** determined, skip this step and leave `classLetter` for a later task (record the gap in the findings doc).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/research/2gathr-api-findings.md packages/lib
git commit -m "docs: record 2gathr/TopPort API inspection findings"
```

---

### Task 9: Workspace-wide verification gate

**Files:** none (verification only).

- [ ] **Step 1: Install clean**

Run: `pnpm install`
Expected: no errors; lockfile stable.

- [ ] **Step 2: Typecheck everything**

Run: `pnpm typecheck`
Expected: all workspace packages exit 0.

- [ ] **Step 3: Lint everything**

Run: `pnpm lint`
Expected: 0 errors across packages.

- [ ] **Step 4: Test everything**

Run: `pnpm test`
Expected: `@repo/lib`, `@repo/db`, `@repo/2gathr` test suites PASS.

- [ ] **Step 5: Format check**

Run: `pnpm exec oxfmt --check .`
Expected: no files need formatting (run `pnpm format` and re-commit if any do).

- [ ] **Step 6: Final commit if formatting changed anything**

```bash
git add -A
git commit -m "chore: workspace verification gate for foundation"
```

---

## Self-Review

**1. Spec coverage (Phase 0 scope):**

- pnpm+turbo+oxlint/oxfmt monorepo → Tasks 1–3. ✓
- `packages/db` (Drizzle, two DBs) → Task 5. ✓
- `packages/lib` → Task 4. ✓
- `packages/2gathr` stub → Task 6. ✓
- `packages/{lint,tsconfig}` → Tasks 2–3. ✓
- docker-compose (PG18 + Valkey) → Task 7 (adopts the reference's two-DB + pgbouncer refinement). ✓
- `.env` / `.env.example` → Task 1 + Task 7 Step 5. ✓
- HTTP-inspection task → Task 8. ✓
- Not in this plan (correctly deferred to later plans): Subsquid indexer, worker, website, better-auth (Phase 2), nickname routes / Piece Book / websocket (Phase 3). Indexer schema pull is stubbed (Task 5 Step 9) pending the Indexer plan.

**2. Placeholder scan:** No "TBD/TODO/implement later" in code steps. The one intentionally-empty file (`src/indexer/schema.ts`) is explicitly a pull target with a comment, and `class.ts` is conditional on Task 8 findings with a documented gap fallback — both are called out, not silent gaps.

**3. Type consistency:** `parsePieceName` (Task 4) returns `{ member, designNumber, hidden }` and is consumed with those exact names in Task 6's `parsePieceMetadata`. `PieceMetadata`/`pieceMetadataSchema` defined in Task 6 Step 5 and used in Step 8. `citext` signature defined in Task 5 Step 5 matches its use in Steps 6. DB client names `db` / `indexer` and table names `pieceDesignMeta`/`addressProfile`/`rollupStat` are consistent across Steps 6–9 and the schema test.

**Refinement noted vs. spec:** the spec described "one Postgres, two logical schemas"; this plan uses the reference's **two separate databases** (`main` + `indexer`) behind pgbouncer, which is cleaner for Subsquid ownership. Downstream plans and the spec's Section 5/9 should read "two databases."
