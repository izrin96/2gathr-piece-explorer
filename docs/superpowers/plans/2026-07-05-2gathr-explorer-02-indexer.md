# 2GATHR Explorer — Plan 2: Subsquid Indexer (Phase 1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/indexer` — a Subsquid EVM processor that wildcard-indexes every on-chain `Transfer` on the Titan L1 (chainId 84358) into the `indexer` database: Ruby (ERC-20) transfers, and auto-registered Piece (ERC-721) collections with their tokens (serial = tokenId) and transfers — then expose those tables to the rest of the monorepo as a read-only Drizzle schema.

**Architecture:** A standalone Subsquid `EvmBatchProcessor` in **RPC-only mode** (no archive gateway exists for Titan) subscribes to the ERC `Transfer` topic across **all** contracts. Each log is classified by topic arity: 4 topics → ERC-721 Piece (tokenId indexed), 3 topics from the known Ruby address → ERC-20 Ruby. Pieces auto-register a `piece_collection` on first sight (reading on-chain `name()`/`symbol()` once), maintain a `piece_token` per serial, and append a `piece_transfer` per event; Ruby appends a `ruby_transfer`. Subsquid + TypeORM (`typeorm-store`) own the `indexer` database end-to-end; `@repo/db` introspects those tables into `src/indexer/` via `drizzle-kit pull` for read-only consumption by the (future) worker and website. The indexer stays deterministic and replayable from chain data alone — no IPFS/TopPort fetching (that is the worker's job).

**Tech Stack:** Subsquid (`@subsquid/evm-processor`, `@subsquid/evm-abi`, `@subsquid/evm-codec`, `@subsquid/typeorm-store`, `@subsquid/typeorm-migration`, `@subsquid/typeorm-codegen`), TypeORM 0.3, Postgres 18, TypeScript 7 rc (tsc → CJS), zod 4, `@dotenvx/dotenvx` for env loading, Drizzle 1.0-rc (`drizzle-kit pull`) in `@repo/db`.

## Global Constraints

- Package manager: **pnpm@11** (use `pnpm` for every command, never npm/yarn/bun). Node runtime (no Bun).
- **Dependency versions live in pnpm catalogs** (`pnpm-workspace.yaml`): packages reference `catalog:` / `catalog:dev`, never pin a version in a `package.json`. New Subsquid/TypeORM deps must be **added to the catalog first** (Task 1).
- **Internal deps** use `workspace:*`. Internal package names: `@repo/{tsconfig,lint,lib,db,2gathr}`.
- Lint = `oxlint --type-aware`; format = `oxfmt`. A clean oxlint run prints nothing and exits 0 — check the exit code, not stdout.
- **Two databases, never crossed:** the indexer owns the `indexer` database via TypeORM migrations and connects to it **directly** (Postgres host port **5434**, `DB_URL`) — never through pgbouncer, because Subsquid runs long/DDL transactions that pgbouncer transaction pooling breaks. The app/worker read the same database **read-only** through pgbouncer-indexer (host port **5435**, `INDEXER_DATABASE_URL`).
- **`nodenext` + `.js` extensions** is the convention for the ESM `@repo/*` packages. **`apps/indexer` is an explicit exception: it is a CommonJS Subsquid app** (no `"type": "module"`), so its relative imports are **extensionless** (`./env`, `./abi/erc721`, `./model`) — matching Subsquid's codegen output, which emits extensionless imports. Do not add `.js` extensions inside `apps/indexer/src`.
- On-chain facts (verified against Titan L1): chain **TITAN**, `chainId 84358`, RPC `https://subnets.avax.network/titan/mainnet/rpc`, **no Subsquid archive** → RPC-only, `eth_getLogs` capped at **2048 blocks/request**. Ruby ERC-20 = `0x16ac90358d5f8610a85fa5270659356afdc48a9e`. Piece = many ERC-721 contracts, one per design; **serial = on-chain `tokenId`**. ERC `Transfer` topic0 = `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` (shared by ERC-20 and ERC-721; discriminate by topic count).
- **Indexer purity:** no IPFS/TopPort/off-chain fetching in the indexer. The only permitted RPC reads beyond logs are one-time on-chain `name()`/`symbol()` per new collection (deterministic, replayable). Metadata/class/media enrichment belongs to the worker (a later plan).
- **`ruby_balance` rollup is out of scope here** — it is a worker-owned derived rollup (later plan). The indexer stores only raw `ruby_transfer` rows.
- Commit after every task with a Conventional Commit message.

---

### Task 1: Add Subsquid + TypeORM deps to the pnpm catalog

**Files:**

- Modify: `pnpm-workspace.yaml`

**Interfaces:**

- Produces (new `catalog:` entries): `@subsquid/evm-abi`, `@subsquid/evm-codec`, `@subsquid/evm-processor`, `@subsquid/typeorm-store`, `typeorm`. (`pg`, `zod` already in `catalog:`.)
- Produces (new `catalog:dev` entries): `@subsquid/typeorm-migration`, `@subsquid/typeorm-codegen`, `@dotenvx/dotenvx`. (`typescript`, `turbo` already in `catalog:dev`.)

- [ ] **Step 1: Add the runtime catalog entries**

In `pnpm-workspace.yaml`, extend the top-level `catalog:` block (keep existing keys; add these alphabetically among them):

```yaml
catalog:
  "@subsquid/evm-abi": ^1.0.0
  "@subsquid/evm-codec": ^1.0.0
  "@subsquid/evm-processor": ^1.30.1
  "@subsquid/typeorm-store": ^1.9.1
  drizzle-orm: ^1.0.0-rc.4-5d5b77c
  ofetch: ^1.5.1
  pg: ^8.22.0
  typeorm: ^0.3.30
  zod: ^4.4.3
```

- [ ] **Step 2: Add the dev catalog entries**

Extend the `catalogs.dev` block (keep existing keys; add these):

```yaml
catalogs:
  dev:
    "@dotenvx/dotenvx": ^1.51.0
    "@subsquid/typeorm-codegen": ^2.2.0
    "@subsquid/typeorm-migration": ^1.3.1
    "@types/node": ^26.0.1
    "@types/pg": ^8.20.0
    drizzle-kit: ^1.0.0-rc.4-5d5b77c
    turbo: ^2.10.2
    typescript: ^7.0.1-rc
    vitest: ^3.2.4
```

- [ ] **Step 3: Verify the workspace file still parses**

Run: `pnpm install`
Expected: completes without a YAML/catalog error (packages that reference these catalog entries don't exist yet, so nothing new is downloaded; the point is that the file is valid).

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: add subsquid + typeorm deps to pnpm catalog"
```

---

### Task 2: Scaffold the `apps/indexer` package

**Files:**

- Create: `apps/indexer/package.json`
- Create: `apps/indexer/tsconfig.json`
- Create: `apps/indexer/tsconfig.build.json`
- Create: `apps/indexer/oxlint.config.mts`
- Create: `apps/indexer/turbo.json`
- Create: `apps/indexer/.gitignore`
- Create: `apps/indexer/src/env.ts`
- Modify: `.env.example` (add the indexer's direct `DB_URL`)
- Modify: `.gitignore` (root — ignore the indexer's generated build/migration artifacts, if not already covered)

**Interfaces:**

- Consumes: `.env` variables `INDEXER_RPC_ENDPOINT`, `INDEXER_RPC_RATE_LIMIT`, `INDEXER_RPC_FINALITY`, `INDEXER_START_BLOCK`, `INDEXER_GETLOGS_RANGE`, `INDEXER_RUBY_ADDRESS` (already in `.env.example`), plus new `DB_URL` (indexer database, direct 5434).
- Produces: `env` — a validated, typed config object exported from `apps/indexer/src/env.ts`. Fields (exact names used by later tasks): `env.INDEXER_RPC_ENDPOINT`, `env.INDEXER_RPC_RATE_LIMIT`, `env.INDEXER_RPC_FINALITY`, `env.INDEXER_START_BLOCK`, `env.INDEXER_GETLOGS_RANGE`, `env.INDEXER_RUBY_ADDRESS` (lowercased), `env.DB_URL`.

- [ ] **Step 1: Create `apps/indexer/package.json`**

Note: **no `"type": "module"`** — this app is CommonJS (see Global Constraints).

```json
{
  "name": "indexer",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "rm -rf lib && tsc -p tsconfig.build.json",
    "codegen": "squid-typeorm-codegen",
    "migration:generate": "dotenvx run -f ../../.env -- squid-typeorm-migration generate",
    "migration:apply": "dotenvx run -f ../../.env -- squid-typeorm-migration apply",
    "process": "dotenvx run -f ../../.env -- node lib/main.js",
    "start": "node lib/main.js",
    "lint": "oxlint --type-aware --config ./oxlint.config.mts",
    "lint:fix": "oxlint --type-aware --fix --config ./oxlint.config.mts",
    "typecheck": "tsc --pretty --noEmit",
    "format": "oxfmt ."
  },
  "dependencies": {
    "@subsquid/evm-abi": "catalog:",
    "@subsquid/evm-codec": "catalog:",
    "@subsquid/evm-processor": "catalog:",
    "@subsquid/typeorm-store": "catalog:",
    "pg": "catalog:",
    "typeorm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@dotenvx/dotenvx": "catalog:dev",
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "@subsquid/typeorm-codegen": "catalog:dev",
    "@subsquid/typeorm-migration": "catalog:dev",
    "@types/pg": "catalog:dev",
    "turbo": "catalog:dev",
    "typescript": "catalog:dev"
  }
}
```

- [ ] **Step 2: Create `apps/indexer/tsconfig.json`** (typecheck config)

```json
{
  "extends": "@repo/tsconfig/tsconfig.node.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", ".turbo", "lib"],
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": false,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create `apps/indexer/tsconfig.build.json`** (emit config)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "allowImportingTsExtensions": false,
    "outDir": "lib",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "lib"]
}
```

- [ ] **Step 4: Create `apps/indexer/oxlint.config.mts`**

```typescript
import baseConfig from "@repo/lint/oxlint.config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: ["node_modules", ".turbo", "lib", "src/model/generated/**", "db/migrations/**"],
});
```

- [ ] **Step 5: Create `apps/indexer/turbo.json`**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["lib/**"] }
  }
}
```

- [ ] **Step 6: Create `apps/indexer/.gitignore`**

```
lib/
.turbo/
```

> `db/migrations/` is **committed** (the migration history is source of truth), so it is not ignored here.

- [ ] **Step 7: Create `apps/indexer/src/env.ts`**

```typescript
import * as z from "zod";

const envSchema = z.object({
  INDEXER_RPC_ENDPOINT: z.url(),
  INDEXER_RPC_RATE_LIMIT: z.coerce.number().positive().default(5),
  INDEXER_RPC_FINALITY: z.coerce.number().positive().default(10),
  INDEXER_START_BLOCK: z.coerce.number().nonnegative().default(0),
  INDEXER_GETLOGS_RANGE: z.coerce.number().positive().default(2048),
  INDEXER_RUBY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((s) => s.toLowerCase()),
  // Direct connection to the indexer Postgres (host port 5434). Never pgbouncer.
  // Consumed implicitly by @subsquid/typeorm-store + squid-typeorm-migration.
  DB_URL: z.url(),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 8: Add the indexer's direct `DB_URL` to `.env.example`**

In the `# ---- indexer (Titan L1, RPC-only; no archive) ----` section of `.env.example`, add this line (the indexer connects **directly** to Postgres for DDL + long transactions; the pooled `INDEXER_DATABASE_URL` at 5435 remains the app/worker read-only URL):

```
# indexer processor + migrations connect DIRECTLY to Postgres (bypass pgbouncer)
DB_URL="postgres://postgres:postgres@localhost:5434/indexer"
```

- [ ] **Step 9: Ensure root `.gitignore` ignores nested `lib/` and `.turbo/`**

Confirm the root `.gitignore` already contains `lib/` and `.turbo/` (the Foundation plan added them). If `lib/` is missing, add it. No change if already present.

- [ ] **Step 10: Install and typecheck the skeleton**

Run: `pnpm install`
Expected: resolves the new Subsquid/TypeORM packages for `indexer` without error.

Run: `pnpm --filter indexer typecheck`
Expected: exits 0 (only `src/env.ts` exists so far).

- [ ] **Step 11: Commit**

```bash
git add apps/indexer .env.example .gitignore pnpm-lock.yaml
git commit -m "chore(indexer): scaffold apps/indexer package + env"
```

---

### Task 3: ABI modules (ERC-721 + ERC-20) with decode tests (TDD)

**Files:**

- Create: `apps/indexer/src/abi/abi.support.ts`
- Create: `apps/indexer/src/abi/erc721.ts`
- Create: `apps/indexer/src/abi/erc20.ts`
- Create: `apps/indexer/vitest.config.ts`
- Create: `apps/indexer/src/abi/abi.test.ts`

**Interfaces:**

- Produces:
  - `apps/indexer/src/abi/erc721.ts`: `events.Transfer` (topic + `.decode(log) => { from, to, tokenId: bigint }`), `functions.name` / `functions.symbol`, and `class Contract extends ContractBase` with `.name(): Promise<string>` and `.symbol(): Promise<string>`.
  - `apps/indexer/src/abi/erc20.ts`: `events.Transfer` (`.decode(log) => { from, to, value: bigint }`).
  - Both `events.Transfer.topic === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"`.
- Consumes: `@subsquid/evm-abi` (`event`, `func`, `indexed`, `ContractBase`), `@subsquid/evm-codec` (`address`, `uint256`, `string`).

- [ ] **Step 1: Create `apps/indexer/src/abi/abi.support.ts`**

```typescript
export { ContractBase, event, func, indexed } from "@subsquid/evm-abi";
export type { EventParams, FunctionArguments, FunctionReturn } from "@subsquid/evm-abi";
```

- [ ] **Step 2: Create `apps/indexer/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

> Vitest resolves TypeScript directly, so tests don't need the `experimentalDecorators` build path. Add `vitest` to devDependencies in the next step.

- [ ] **Step 3: Add `vitest` + `test` script to `apps/indexer/package.json`**

Add `"test": "vitest run"` to `scripts` (after `"format"`), and add `"vitest": "catalog:dev"` to `devDependencies`. Run `pnpm install` afterward.

- [ ] **Step 4: Write the failing test `apps/indexer/src/abi/abi.test.ts`**

Fixtures are real ABI-encoded logs: a mint of ERC-721 tokenId `258` (from zero → the Ruby address, used here only as an arbitrary valid 20-byte address), and an ERC-20 transfer of `1e18`.

```typescript
import { describe, expect, it } from "vitest";

import * as ERC20 from "./erc20";
import * as ERC721 from "./erc721";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADDR_TOPIC = "0x00000000000000000000000016ac90358d5f8610a85fa5270659356afdc48a9e";
const TOKEN_258 = "0x0000000000000000000000000000000000000000000000000000000000000102";
const VALUE_1E18 = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000";

describe("erc721 Transfer", () => {
  it("exposes the canonical Transfer topic0", () => {
    expect(ERC721.events.Transfer.topic).toBe(TRANSFER_TOPIC);
  });

  it("decodes a 4-topic ERC-721 Transfer (tokenId indexed)", () => {
    const decoded = ERC721.events.Transfer.decode({
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      data: "0x",
    });
    expect(decoded.from.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded.to.toLowerCase()).toBe("0x16ac90358d5f8610a85fa5270659356afdc48a9e");
    expect(decoded.tokenId).toBe(258n);
  });
});

describe("erc20 Transfer", () => {
  it("decodes a 3-topic ERC-20 Transfer (value in data)", () => {
    const decoded = ERC20.events.Transfer.decode({
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC],
      data: VALUE_1E18,
    });
    expect(decoded.from.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded.to.toLowerCase()).toBe("0x16ac90358d5f8610a85fa5270659356afdc48a9e");
    expect(decoded.value).toBe(1000000000000000000n);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm --filter indexer test`
Expected: FAIL — cannot resolve `./erc721` / `./erc20`.

- [ ] **Step 6: Implement `apps/indexer/src/abi/erc721.ts`**

```typescript
import { address, string as abiString, uint256 } from "@subsquid/evm-codec";

import { ContractBase, event, func, indexed } from "./abi.support";

export const events = {
  /** Transfer(address indexed from, address indexed to, uint256 indexed tokenId) */
  Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", {
    from: indexed(address),
    to: indexed(address),
    tokenId: indexed(uint256),
  }),
};

export const functions = {
  /** name() -> string */
  name: func("0x06fdde03", {}, abiString),
  /** symbol() -> string */
  symbol: func("0x95d89b41", {}, abiString),
};

export class Contract extends ContractBase {
  name(): Promise<string> {
    return this.eth_call(functions.name, {});
  }

  symbol(): Promise<string> {
    return this.eth_call(functions.symbol, {});
  }
}
```

- [ ] **Step 7: Implement `apps/indexer/src/abi/erc20.ts`**

```typescript
import { address, uint256 } from "@subsquid/evm-codec";

import { event, indexed } from "./abi.support";

export const events = {
  /** Transfer(address indexed from, address indexed to, uint256 value) */
  Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", {
    from: indexed(address),
    to: indexed(address),
    value: uint256,
  }),
};
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm --filter indexer test`
Expected: all 3 tests PASS.

Run: `pnpm --filter indexer typecheck`
Expected: exits 0.

> If the installed `@subsquid/evm-abi` exports `fun`/`viewFun` with a signature-string argument instead of the legacy `func(selector, args, return)` used above, adjust the `functions` definitions to the installed signature (the tests pin behavior, so let them guide you). The event/decode API is stable.

- [ ] **Step 9: Commit**

```bash
git add apps/indexer/src/abi apps/indexer/vitest.config.ts apps/indexer/package.json pnpm-lock.yaml
git commit -m "feat(indexer): add ERC-721 + ERC-20 ABI modules with decode tests"
```

---

### Task 4: Subsquid schema + generated TypeORM models

**Files:**

- Create: `apps/indexer/schema.graphql`
- Create: `apps/indexer/src/model/index.ts`
- Generated (by codegen, committed): `apps/indexer/src/model/generated/*.model.ts`, `apps/indexer/src/model/generated/marshal.ts`, `apps/indexer/src/model/generated/index.ts`

**Interfaces:**

- Produces the TypeORM entity classes consumed by Task 7's `main.ts` (exact class + property names):
  - `PieceCollection` { `id: string` (contract), `edition: string`, `symbol: string`, `firstSeenBlock: number`, `totalSupply: number` }
  - `PieceToken` { `id: string` (`${contract}-${tokenId}`), `collection: PieceCollection`, `contractAddress: string`, `tokenId: string`, `serial: number`, `owner: string`, `mintedAt: Date`, `lastTransferAt: Date`, `lastTransferBlock: number` }
  - `PieceTransfer` { `id: string` (`${block}-${logIndex}`), `collection: PieceCollection`, `contractAddress: string`, `tokenId: string`, `from: string`, `to: string`, `timestamp: Date`, `blockNumber: number`, `logIndex: number`, `hash: string` }
  - `RubyTransfer` { `id: string` (`${block}-${logIndex}`), `from: string`, `to: string`, `value: bigint`, `timestamp: Date`, `blockNumber: number`, `logIndex: number`, `hash: string` }
- Re-exported from `apps/indexer/src/model/index.ts`.

- [ ] **Step 1: Create `apps/indexer/schema.graphql`**

```graphql
type PieceCollection @entity {
  "contract address (lowercase)"
  id: ID!
  "on-chain name() — the edition label, verbatim"
  edition: String!
  "on-chain symbol()"
  symbol: String!
  firstSeenBlock: Int! @index
  "count of live (non-burned) tokens, maintained incrementally"
  totalSupply: Int!
  tokens: [PieceToken!] @derivedFrom(field: "collection")
  transfers: [PieceTransfer!] @derivedFrom(field: "collection")
}

type PieceToken @entity {
  "`${contractAddress}-${tokenId}`"
  id: ID!
  collection: PieceCollection!
  contractAddress: String! @index
  "decimal string token id"
  tokenId: String!
  "on-chain serial number (= tokenId as an integer)"
  serial: Int! @index
  owner: String! @index
  mintedAt: DateTime!
  lastTransferAt: DateTime! @index
  lastTransferBlock: Int!
}

type PieceTransfer @entity {
  "`${blockNumber}-${logIndex}`"
  id: ID!
  collection: PieceCollection!
  contractAddress: String! @index
  tokenId: String! @index
  from: String! @index
  to: String! @index
  timestamp: DateTime! @index
  blockNumber: Int! @index
  logIndex: Int!
  hash: String! @index
}

type RubyTransfer @entity {
  "`${blockNumber}-${logIndex}`"
  id: ID!
  from: String! @index
  to: String! @index
  value: BigInt!
  timestamp: DateTime! @index
  blockNumber: Int! @index
  logIndex: Int!
  hash: String! @index
}
```

- [ ] **Step 2: Generate the TypeORM entities from the schema**

Run: `pnpm --filter indexer codegen`
Expected: creates `apps/indexer/src/model/generated/` with `pieceCollection.model.ts`, `pieceToken.model.ts`, `pieceTransfer.model.ts`, `rubyTransfer.model.ts`, `marshal.ts`, and `index.ts`.

- [ ] **Step 3: Create `apps/indexer/src/model/index.ts`**

```typescript
export * from "./generated";
```

- [ ] **Step 4: Verify the generated model exports the expected classes**

Run: `pnpm --filter indexer exec node -e "const m = require('./src/model/generated/index.ts'); console.log(Object.keys(m))"` — if that fails because of TS, instead grep the generated index:

Run: `grep -o "export \* from \"\./[a-zA-Z]*\.model\"" apps/indexer/src/model/generated/index.ts`
Expected: four lines referencing `pieceCollection.model`, `pieceToken.model`, `pieceTransfer.model`, `rubyTransfer.model`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter indexer typecheck`
Expected: exits 0 (generated entities + `model/index.ts` compile).

- [ ] **Step 6: Commit**

```bash
git add apps/indexer/schema.graphql apps/indexer/src/model
git commit -m "feat(indexer): add subsquid schema + generated typeorm models"
```

---

### Task 5: Processor configuration (wildcard, RPC-only)

**Files:**

- Create: `apps/indexer/src/processor.ts`

**Interfaces:**

- Consumes: `env` (Task 2), `ERC721.events.Transfer.topic` (Task 3).
- Produces:
  - `processor` — a configured `EvmBatchProcessor` subscribed to the `Transfer` topic across **all** contracts (no address filter).
  - Type exports used by later tasks: `Fields`, `Block`, `Log`, `Transaction`, `ProcessorContext<Store>`.

- [ ] **Step 1: Create `apps/indexer/src/processor.ts`**

```typescript
import {
  type BlockHeader,
  type DataHandlerContext,
  EvmBatchProcessor,
  type EvmBatchProcessorFields,
  type Log as _Log,
  type Transaction as _Transaction,
} from "@subsquid/evm-processor";

import * as ERC721 from "./abi/erc721";
import { env } from "./env";

// Shared ERC Transfer topic0 (ERC-20 and ERC-721 both emit it).
const TRANSFER_TOPIC = ERC721.events.Transfer.topic;

const processor = new EvmBatchProcessor()
  // RPC-only: Titan L1 has no Subsquid archive/gateway.
  .setRpcEndpoint({
    url: env.INDEXER_RPC_ENDPOINT,
    rateLimit: env.INDEXER_RPC_RATE_LIMIT,
  })
  // Bound each eth_getLogs request to Titan's 2048-block cap. strideSize is the
  // number of blocks fetched per RPC stride; keeping it <= 2048 avoids the cap.
  .setRpcDataIngestionSettings({ strideSize: env.INDEXER_GETLOGS_RANGE })
  .setFinalityConfirmation(env.INDEXER_RPC_FINALITY)
  .setBlockRange({ from: env.INDEXER_START_BLOCK })
  .setFields({
    log: {
      address: true,
      topics: true,
      data: true,
      transactionHash: true,
      logIndex: true,
    },
  })
  // Wildcard: every Transfer log on the chain, regardless of contract address.
  .addLog({ topic0: [TRANSFER_TOPIC] });

export { processor };
export type Fields = EvmBatchProcessorFields<typeof processor>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext<Store> = DataHandlerContext<Store, Fields>;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter indexer typecheck`
Expected: exits 0.

> If the installed `@subsquid/evm-processor` types reject `.setRpcDataIngestionSettings({ strideSize })`, confirm the option name against the installed `.d.ts` (`node_modules/@subsquid/evm-processor/lib/processor.d.ts`) and adjust. `strideSize` bounds the getLogs window; if the setter is unavailable in this version, the processor's default stride is already smaller than 2048 (so it is an efficiency knob, not a correctness one) — you may drop the call and rely on the default, noting it. The documented hard fallback for RPC misbehavior is the viem-poller (spec §6), out of scope here.

- [ ] **Step 3: Commit**

```bash
git add apps/indexer/src/processor.ts
git commit -m "feat(indexer): configure wildcard RPC-only EVM processor"
```

---

### Task 6: Block parser + log classifier (pure, TDD)

**Files:**

- Create: `apps/indexer/src/parser.ts`
- Create: `apps/indexer/src/parser.test.ts`

**Interfaces:**

- Consumes: `ERC721`/`ERC20` decoders (Task 3), `Log`/`Fields` types (Task 5).
- Produces:
  - `type PieceTransferEvent = { contract: string; tokenId: string; from: string; to: string; timestamp: number; blockNumber: number; logIndex: number; hash: string }`
  - `type RubyTransferEvent = { from: string; to: string; value: bigint; timestamp: number; blockNumber: number; logIndex: number; hash: string }`
  - `classifyTransferLog(log, rubyAddress): "erc721" | "ruby" | "ignore"` — topic-arity classifier.
  - `parsePieceTransfer(log): PieceTransferEvent | undefined`
  - `parseRubyTransfer(log): RubyTransferEvent | undefined`
  - `parseBlocks(blocks, rubyAddress): { pieceTransfers: PieceTransferEvent[]; rubyTransfers: RubyTransferEvent[] }`
  - All addresses lowercased.

- [ ] **Step 1: Write the failing test `apps/indexer/src/parser.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { classifyTransferLog, parsePieceTransfer, parseRubyTransfer } from "./parser";
import type { Log } from "./processor";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const OTHER_TOPIC = "0x1111111111111111111111111111111111111111111111111111111111111111";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADDR_TOPIC = "0x00000000000000000000000016ac90358d5f8610a85fa5270659356afdc48a9e";
const TOKEN_258 = "0x0000000000000000000000000000000000000000000000000000000000000102";
const VALUE_1E18 = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000";
const RUBY = "0x16ac90358d5f8610a85fa5270659356afdc48a9e";

function log(partial: Partial<Log>): Log {
  return {
    address: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
    topics: [],
    data: "0x",
    logIndex: 3,
    transactionHash: "0xdeadbeef",
    block: { height: 1000, timestamp: 1_700_000_000_000 },
    ...partial,
  } as unknown as Log;
}

describe("classifyTransferLog", () => {
  it("classifies a 4-topic Transfer as erc721", () => {
    expect(
      classifyTransferLog(
        log({ topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258] }),
        RUBY,
      ),
    ).toBe("erc721");
  });

  it("classifies a 3-topic Transfer from the Ruby address as ruby", () => {
    expect(
      classifyTransferLog(
        log({ address: RUBY, topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC] }),
        RUBY,
      ),
    ).toBe("ruby");
  });

  it("ignores a 3-topic Transfer from a non-Ruby ERC-20", () => {
    expect(
      classifyTransferLog(log({ topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC] }), RUBY),
    ).toBe("ignore");
  });

  it("ignores a non-Transfer topic0", () => {
    expect(
      classifyTransferLog(log({ topics: [OTHER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258] }), RUBY),
    ).toBe("ignore");
  });
});

describe("parsePieceTransfer", () => {
  it("parses a mint, lowercasing addresses and stringifying tokenId", () => {
    const e = parsePieceTransfer(
      log({
        address: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
        topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC, TOKEN_258],
      }),
    );
    expect(e).toEqual({
      contract: "0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884",
      tokenId: "258",
      from: "0x0000000000000000000000000000000000000000",
      to: "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
      timestamp: 1_700_000_000_000,
      blockNumber: 1000,
      logIndex: 3,
      hash: "0xdeadbeef",
    });
  });
});

describe("parseRubyTransfer", () => {
  it("parses the value from data as a bigint", () => {
    const e = parseRubyTransfer(
      log({ address: RUBY, topics: [TRANSFER_TOPIC, ZERO_TOPIC, ADDR_TOPIC], data: VALUE_1E18 }),
    );
    expect(e).toEqual({
      from: "0x0000000000000000000000000000000000000000",
      to: "0x16ac90358d5f8610a85fa5270659356afdc48a9e",
      value: 1_000_000_000_000_000_000n,
      timestamp: 1_700_000_000_000,
      blockNumber: 1000,
      logIndex: 3,
      hash: "0xdeadbeef",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter indexer test`
Expected: FAIL — cannot resolve `./parser`.

- [ ] **Step 3: Implement `apps/indexer/src/parser.ts`**

```typescript
import type { BlockData } from "@subsquid/evm-processor";

import * as ERC20 from "./abi/erc20";
import * as ERC721 from "./abi/erc721";
import type { Fields, Log } from "./processor";

const TRANSFER_TOPIC = ERC721.events.Transfer.topic;

export type PieceTransferEvent = {
  contract: string;
  tokenId: string;
  from: string;
  to: string;
  timestamp: number;
  blockNumber: number;
  logIndex: number;
  hash: string;
};

export type RubyTransferEvent = {
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  blockNumber: number;
  logIndex: number;
  hash: string;
};

/**
 * Classify a Transfer log by topic arity: ERC-721 indexes tokenId (4 topics),
 * ERC-20 carries value in data (3 topics). Only the known Ruby ERC-20 is kept;
 * all other ERC-20s are ignored.
 */
export function classifyTransferLog(
  log: Pick<Log, "topics" | "address">,
  rubyAddress: string,
): "erc721" | "ruby" | "ignore" {
  if (log.topics[0] !== TRANSFER_TOPIC) {
    return "ignore";
  }
  if (log.topics.length === 4) {
    return "erc721";
  }
  if (log.topics.length === 3 && log.address.toLowerCase() === rubyAddress) {
    return "ruby";
  }
  return "ignore";
}

export function parsePieceTransfer(log: Log): PieceTransferEvent | undefined {
  try {
    const { from, to, tokenId } = ERC721.events.Transfer.decode(log);
    return {
      contract: log.address.toLowerCase(),
      tokenId: tokenId.toString(),
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      timestamp: log.block.timestamp,
      blockNumber: log.block.height,
      logIndex: log.logIndex,
      hash: log.transactionHash,
    };
  } catch {
    return undefined;
  }
}

export function parseRubyTransfer(log: Log): RubyTransferEvent | undefined {
  try {
    const { from, to, value } = ERC20.events.Transfer.decode(log);
    return {
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      value,
      timestamp: log.block.timestamp,
      blockNumber: log.block.height,
      logIndex: log.logIndex,
      hash: log.transactionHash,
    };
  } catch {
    return undefined;
  }
}

/**
 * Walk every log in the batch (block + log order preserved) and split into
 * classified Piece / Ruby transfer events.
 */
export function parseBlocks(blocks: BlockData<Fields>[], rubyAddress: string) {
  const pieceTransfers: PieceTransferEvent[] = [];
  const rubyTransfers: RubyTransferEvent[] = [];

  for (const block of blocks) {
    for (const log of block.logs) {
      switch (classifyTransferLog(log, rubyAddress)) {
        case "erc721": {
          const e = parsePieceTransfer(log);
          if (e) {
            pieceTransfers.push(e);
          }
          break;
        }
        case "ruby": {
          const e = parseRubyTransfer(log);
          if (e) {
            rubyTransfers.push(e);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return { pieceTransfers, rubyTransfers };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter indexer test`
Expected: all classifier + parser tests PASS.

Run: `pnpm --filter indexer typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/indexer/src/parser.ts apps/indexer/src/parser.test.ts
git commit -m "feat(indexer): add pure transfer classifier + block parser with tests"
```

---

### Task 7: Processing loop (`main.ts`)

**Files:**

- Create: `apps/indexer/src/main.ts`

**Interfaces:**

- Consumes: `env`, `processor`/`ProcessorContext`, `parseBlocks`, the four model classes, `ERC721.Contract`.
- Produces: the `processor.run(...)` handler that upserts collections/tokens and appends transfers. No new exported symbols (this is the entrypoint compiled to `lib/main.js`).

- [ ] **Step 1: Create `apps/indexer/src/main.ts`**

```typescript
import { TypeormDatabase, type Store } from "@subsquid/typeorm-store";

import * as ERC721 from "./abi/erc721";
import { env } from "./env";
import { PieceCollection, PieceToken, PieceTransfer, RubyTransfer } from "./model";
import { parseBlocks, type PieceTransferEvent } from "./parser";
import { processor, type Block, type ProcessorContext } from "./processor";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const database = new TypeormDatabase({ supportHotBlocks: true });

processor.run(database, async (ctx) => {
  const { pieceTransfers, rubyTransfers } = parseBlocks(ctx.blocks, env.INDEXER_RUBY_ADDRESS);

  // ---- Ruby (ERC-20) transfers: append-only ----
  if (rubyTransfers.length > 0) {
    ctx.log.info(`Processing ${rubyTransfers.length} Ruby transfers`);
    await ctx.store.insert(
      rubyTransfers.map(
        (t) =>
          new RubyTransfer({
            id: `${t.blockNumber}-${t.logIndex}`,
            from: t.from,
            to: t.to,
            value: t.value,
            timestamp: new Date(t.timestamp),
            blockNumber: t.blockNumber,
            logIndex: t.logIndex,
            hash: t.hash,
          }),
      ),
    );
  }

  // ---- Piece (ERC-721) transfers: register collections, track tokens, append transfers ----
  if (pieceTransfers.length === 0) {
    return;
  }
  ctx.log.info(`Processing ${pieceTransfers.length} Piece transfers`);

  // Real block headers, needed for on-chain name()/symbol() eth_calls.
  const headerByHeight = new Map<number, Block>(ctx.blocks.map((b) => [b.header.height, b.header]));

  const collectionBuffer = new Map<string, PieceCollection>();
  const tokenBuffer = new Map<string, PieceToken>();
  const transferRows: PieceTransfer[] = [];

  for (const t of pieceTransfers) {
    const collection = await getOrRegisterCollection(ctx, collectionBuffer, headerByHeight, t);

    const tokenKey = `${t.contract}-${t.tokenId}`;
    let token = tokenBuffer.get(tokenKey) ?? (await ctx.store.get(PieceToken, tokenKey));
    const isMint = t.from === ZERO_ADDRESS;
    const isBurn = t.to === ZERO_ADDRESS;

    if (!token) {
      token = new PieceToken({
        id: tokenKey,
        collection,
        contractAddress: t.contract,
        tokenId: t.tokenId,
        serial: Number(t.tokenId),
        owner: t.to,
        mintedAt: new Date(t.timestamp),
        lastTransferAt: new Date(t.timestamp),
        lastTransferBlock: t.blockNumber,
      });
      if (isMint) {
        collection.totalSupply += 1;
      }
    } else {
      token.owner = t.to;
      token.lastTransferAt = new Date(t.timestamp);
      token.lastTransferBlock = t.blockNumber;
      token.collection = collection;
    }

    if (isBurn) {
      collection.totalSupply = Math.max(0, collection.totalSupply - 1);
    }

    tokenBuffer.set(tokenKey, token);
    collectionBuffer.set(collection.id, collection);

    transferRows.push(
      new PieceTransfer({
        id: `${t.blockNumber}-${t.logIndex}`,
        collection,
        contractAddress: t.contract,
        tokenId: t.tokenId,
        from: t.from,
        to: t.to,
        timestamp: new Date(t.timestamp),
        blockNumber: t.blockNumber,
        logIndex: t.logIndex,
        hash: t.hash,
      }),
    );
  }

  if (collectionBuffer.size > 0) {
    await ctx.store.upsert([...collectionBuffer.values()]);
  }
  if (tokenBuffer.size > 0) {
    await ctx.store.upsert([...tokenBuffer.values()]);
  }
  if (transferRows.length > 0) {
    await ctx.store.insert(transferRows);
  }
});

/**
 * Return the Piece collection for a transfer, auto-registering it on first
 * sight. Registration reads on-chain name()/symbol() once (deterministic,
 * replayable); failures degrade to empty strings so a flaky read never blocks
 * indexing — the worker can backfill edition/symbol later.
 */
async function getOrRegisterCollection(
  ctx: ProcessorContext<Store>,
  buffer: Map<string, PieceCollection>,
  headerByHeight: Map<number, Block>,
  t: PieceTransferEvent,
): Promise<PieceCollection> {
  const existing = buffer.get(t.contract) ?? (await ctx.store.get(PieceCollection, t.contract));
  if (existing) {
    return existing;
  }

  const header = headerByHeight.get(t.blockNumber);
  let edition = "";
  let symbol = "";
  if (header) {
    const contract = new ERC721.Contract(ctx, header, t.contract);
    try {
      edition = await contract.name();
    } catch {
      ctx.log.warn(`name() failed for ${t.contract}`);
    }
    try {
      symbol = await contract.symbol();
    } catch {
      ctx.log.warn(`symbol() failed for ${t.contract}`);
    }
  }

  const collection = new PieceCollection({
    id: t.contract,
    edition,
    symbol,
    firstSeenBlock: t.blockNumber,
    totalSupply: 0,
  });
  buffer.set(t.contract, collection);
  return collection;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter indexer typecheck`
Expected: exits 0.

> If `new ERC721.Contract(ctx, header, address)` is rejected by the installed `ContractBase` constructor signature, check `node_modules/@subsquid/evm-abi/lib/contract-base.d.ts`. The expected shape is `(ctx: { _chain }, block: { height: number } | BlockHeader, address: string)`; `header` (a `BlockHeader`) satisfies it. If the version wants a plain height, pass `t.blockNumber` instead.

- [ ] **Step 3: Build to verify the CommonJS emit succeeds**

Run: `pnpm --filter indexer build`
Expected: creates `apps/indexer/lib/main.js` (+ compiled `lib/model`, `lib/abi`, etc.) with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/indexer/src/main.ts
git commit -m "feat(indexer): add processing loop for pieces + ruby transfers"
```

---

### Task 8: Migrations + live smoke run against Titan

**Files:**

- Create (generated, committed): `apps/indexer/db/migrations/<timestamp>-Data.js`

**Interfaces:**

- Produces: the `indexer` database populated with `piece_collection`, `piece_token`, `piece_transfer`, `ruby_transfer` tables (+ Subsquid's status table), and real indexed rows from Titan.

- [ ] **Step 1: Ensure the dev stack is up and prepare `.env`**

Run: `docker compose up -d postgres postgres-indexer valkey`
Expected: containers start. (If host port 5434 fails to bind, check `docker compose ps` for a sibling project's Postgres — see AGENTS.md gotchas.)

Ensure a root `.env` exists (copy from example if needed) and that it contains the `DB_URL` line added in Task 2 Step 8:

Run: `test -f .env || cp .env.example .env`
Then confirm: `grep '^DB_URL=' .env`
Expected: prints the direct 5434 indexer URL. (Edit `.env` to add it if you started from an older `.env`.)

- [ ] **Step 2: Confirm the indexer database is reachable directly (5434)**

Run: `docker compose exec postgres-indexer psql -U postgres -d indexer -c "select 1;"`
Expected: returns a single row `1`.

- [ ] **Step 3: Build, then generate the initial migration from the entities**

`squid-typeorm-migration generate` diffs the compiled entities (`lib/model`) against the live database, so build first and make sure the DB is empty of our tables.

Run: `pnpm --filter indexer build`
Run: `pnpm --filter indexer migration:generate`
Expected: writes `apps/indexer/db/migrations/<timestamp>-Data.js` containing `CREATE TABLE "piece_collection" …`, `"piece_token"`, `"piece_transfer"`, `"ruby_transfer"`.

> If generate reports "no changes", the tables already exist from a previous run — drop them first: `docker compose exec postgres-indexer psql -U postgres -d indexer -c "drop table if exists piece_transfer, piece_token, ruby_transfer, piece_collection cascade;"` then re-run.

- [ ] **Step 4: Apply the migration**

Run: `pnpm --filter indexer migration:apply`
Expected: applies the migration; `\dt` now shows the four tables.

Run: `docker compose exec postgres-indexer psql -U postgres -d indexer -c "\dt"`
Expected: lists `piece_collection`, `piece_token`, `piece_transfer`, `ruby_transfer`.

- [ ] **Step 5: Run the processor against Titan for a short window, then stop**

Run (background it, capture logs, let it index for ~90s, then stop):

```bash
cd apps/indexer && pnpm process > /tmp/indexer-smoke.log 2>&1 &
INDEXER_PID=$!
sleep 90
kill $INDEXER_PID 2>/dev/null || true
cd ../..
tail -n 30 /tmp/indexer-smoke.log
```

Expected: log lines like `Processing N Piece transfers` / `Processing N Ruby transfers` and progress advancing through blocks, with **no** repeated `eth_getLogs` "range" / "block range too large" errors (which would indicate the 2048 cap is being exceeded — if so, lower `INDEXER_GETLOGS_RANGE` in `.env`).

- [ ] **Step 6: Verify rows landed and collections registered with editions**

Run: `docker compose exec postgres-indexer psql -U postgres -d indexer -c "select count(*) from piece_collection; select count(*) from piece_token; select count(*) from ruby_transfer;"`
Expected: non-zero counts (the chain indexes from block 0; even a short run captures early transfers).

Run: `docker compose exec postgres-indexer psql -U postgres -d indexer -c "select id, edition, symbol, total_supply from piece_collection order by first_seen_block limit 5;"`
Expected: rows with a lowercase contract `id` and a populated `edition` (e.g. an edition label from `name()`), confirming the eth_call path works.

Run (serial = tokenId sanity check): `docker compose exec postgres-indexer psql -U postgres -d indexer -c "select token_id, serial from piece_token limit 3;"`
Expected: `serial` equals `token_id` cast to an integer.

- [ ] **Step 7: Commit the migration**

```bash
git add apps/indexer/db/migrations
git commit -m "feat(indexer): add initial typeorm migration for indexer tables"
```

---

### Task 9: Wire the indexer tables into `@repo/db` as a read-only Drizzle schema

**Files:**

- Modify: `packages/db/drizzle-indexer.config.ts` (fix `out` so pull writes into `src/indexer/`)
- Modify: `packages/db/src/indexer/schema.ts` (replaced by the pull output)
- Modify: `packages/db/src/indexer/index.ts` (re-export the pulled schema)
- Modify: `packages/db/.gitignore` or root `.gitignore` (ignore pull's SQL/meta artifacts)

**Interfaces:**

- Consumes: the live `indexer` database tables created in Task 8.
- Produces: `packages/db/src/indexer/schema.ts` populated with `pieceCollection`, `pieceToken`, `pieceTransfer`, `rubyTransfer` Drizzle table objects; `indexer` client (already exported) plus a re-exported `schema`.

- [ ] **Step 1: Fix the `out` directory in `packages/db/drizzle-indexer.config.ts`**

Per the AGENTS.md Plan-2 TODO, point `out` at `src/indexer/` and restrict introspection to our four tables so Subsquid's internal status table is excluded:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/indexer/schema.ts",
  out: "./src/indexer",
  dialect: "postgresql",
  dbCredentials: { url: process.env.INDEXER_DATABASE_URL! },
  tablesFilter: ["piece_collection", "piece_token", "piece_transfer", "ruby_transfer"],
});
```

- [ ] **Step 2: Ignore the pull's SQL/meta artifacts**

`drizzle-kit pull` writes `schema.ts` **and** an introspection SQL file + `meta/` snapshot into `out`. We only want `schema.ts` tracked. Add to `packages/db/.gitignore` (create the file if absent):

```
src/indexer/*.sql
src/indexer/meta/
src/indexer/relations.ts
```

> We keep our hand-written `src/indexer/relation.ts` (singular, `defineRelations`) and ignore drizzle-kit's generated `relations.ts` (plural), which we don't use.

- [ ] **Step 3: Pull the schema from the live database (direct 5434)**

Introspect against the direct Postgres port to avoid any pooling quirks:

Run: `INDEXER_DATABASE_URL="postgres://postgres:postgres@localhost:5434/indexer" pnpm --filter @repo/db db:pull:indexer`
Expected: writes `packages/db/src/indexer/schema.ts` containing `export const pieceCollection = pgTable("piece_collection", { … })` and the three other tables.

- [ ] **Step 4: Verify the pulled schema replaced the placeholder**

Run: `grep -c "pgTable" packages/db/src/indexer/schema.ts`
Expected: `4` (one `pgTable` per indexer table).

- [ ] **Step 5: Re-export the pulled schema from the indexer client**

Update `packages/db/src/indexer/index.ts` to also surface the tables (append the export; keep the existing client):

```typescript
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relation.js";

export const indexer: NodePgDatabase<typeof relations> = drizzle(
  process.env.INDEXER_DATABASE_URL!,
  { relations },
);

export * as indexerSchema from "./schema.js";
```

- [ ] **Step 6: Typecheck `@repo/db`**

Run: `pnpm --filter @repo/db typecheck`
Expected: exits 0 (the pulled `schema.ts` compiles; `relation.ts`'s `defineRelations(schema, () => ({}))` now sees four tables and still resolves).

> If drizzle-kit's pulled `schema.ts` emits `.js`-less relative imports or a `citext`/custom-type mismatch that breaks typecheck, reconcile minimally (e.g. keep the generated column types as-is; addresses come through as `text`). Do not hand-edit table/column names — they must mirror the database.

- [ ] **Step 7: Commit**

```bash
git add packages/db/drizzle-indexer.config.ts packages/db/src/indexer packages/db/.gitignore
git commit -m "feat(db): pull indexer schema into src/indexer as read-only drizzle model"
```

---

### Task 10: Workspace-wide verification gate

**Files:** none (verification only).

- [ ] **Step 1: Install clean**

Run: `pnpm install`
Expected: no errors; lockfile stable.

- [ ] **Step 2: Typecheck everything**

Run: `pnpm typecheck`
Expected: all workspace packages (`indexer`, `@repo/db`, `@repo/lib`, `@repo/2gathr`) exit 0.

- [ ] **Step 3: Lint everything**

Run: `pnpm lint`
Expected: 0 errors. (`indexer` lint ignores `src/model/generated/**` and `db/migrations/**`.)

- [ ] **Step 4: Test everything**

Run: `pnpm test`
Expected: `indexer` (abi + parser suites), `@repo/lib`, `@repo/2gathr`, `@repo/db` suites PASS.

- [ ] **Step 5: Format check**

Run: `pnpm exec oxfmt --check .`
Expected: no files need formatting (run `pnpm format` and re-commit if any do). The generated model, migrations, and pulled schema are covered by oxfmt's `ignorePatterns` (`src/model/generated`) / drizzle output — if oxfmt flags generated files, add the path to `oxfmt.config.ts` `ignorePatterns`.

- [ ] **Step 6: Final commit if anything changed**

```bash
git add -A
git commit -m "chore(indexer): workspace verification gate for the indexer"
```

---

## Self-Review

**1. Spec coverage (Plan 2 / Indexer scope, spec §5–§6 + API findings §"What this changes"):**

- Wildcard on-chain `Transfer` indexing, RPC-only, Titan 84358, 2048-block cap → Task 5 (`addLog({ topic0 })` no address; `setRpcEndpoint` no gateway; `strideSize = INDEXER_GETLOGS_RANGE`). ✓
- Ruby (ERC-20) transfers → `ruby_transfer` → Tasks 4 + 6 + 7. ✓
- Piece (ERC-721) auto-registration, one contract per design, no redeploy on new drops → Task 7 `getOrRegisterCollection` (wildcard means new contracts are picked up automatically). ✓
- Serial = on-chain tokenId → Task 4 (`serial: Int!`) + Task 7 (`serial: Number(t.tokenId)`) + Task 8 Step 6 verification. ✓
- Classification by ERC-165/4-topic Transfer → Task 6 `classifyTransferLog` (topic-arity; simpler and RPC-free vs. a supportsInterface call, which the spec allows as an alternative). ✓
- No metadata fetching in the indexer (kept pure); only on-chain `name()`/`symbol()` → Task 7 (eth_call, deterministic) — IPFS/TopPort enrichment explicitly deferred to the worker. ✓
- `piece_collection` (contract, edition, symbol, firstSeenBlock, totalSupply), `piece_token`, `piece_transfer`, `ruby_transfer` → Task 4 schema. ✓
- `ruby_balance` correctly deferred to the worker (spec marks it optional at indexer level). ✓ (called out in Global Constraints)
- Config `RPC_URL`, `RPC_RATE_LIMIT`, `START_BLOCK`, `FINALITY_CONFIRMATION`, getLogs range → Task 2 `env.ts` (mapped to the existing `INDEXER_*` `.env` names). ✓
- Migrations via `@subsquid/typeorm-migration`; `db:pull:indexer` regenerates the Drizzle read model → Tasks 8 + 9. ✓
- **AGENTS.md TODO** — fix `drizzle-indexer.config.ts` `out` so pull writes into `src/indexer/` → Task 9 Step 1. ✓
- Documented viem-poller fallback for RPC misbehavior → referenced in Task 5 (kept out of scope, as the spec frames it as a fallback). ✓
- TopPort catalog as the primary discovery/metadata source → **worker plan**, not here; the indexer is the ownership source of truth and the safety net for any contract missing from the catalog (spec §"What this changes" point 1). Noted, correctly out of scope for Plan 2.

**2. Placeholder scan:** No "TBD/TODO/implement later" in code steps. The two version-drift notes (Task 3 `func` signature; Task 5 `setRpcDataIngestionSettings`; Task 7 `ContractBase` ctor) are concrete implementations with a verification pointer, not placeholders — each has working code and tests/typecheck to confirm against the installed version. The generated files (`src/model/generated`, pulled `src/indexer/schema.ts`, migration JS) are produced by tools with explicit verification steps, not left as stubs.

**3. Type consistency:** Model class + property names defined in Task 4's Interfaces (`PieceCollection.totalSupply/edition/symbol/firstSeenBlock`, `PieceToken.serial/owner/lastTransferAt/lastTransferBlock/contractAddress/tokenId`, `PieceTransfer`/`RubyTransfer` fields) are used verbatim in Task 7's `main.ts`. `PieceTransferEvent`/`RubyTransferEvent` fields defined in Task 6 (`contract`, `tokenId`, `from`, `to`, `timestamp`, `blockNumber`, `logIndex`, `hash`, `value`) match their consumption in Task 7. `env.INDEXER_*`/`env.DB_URL` names defined in Task 2 match Tasks 5 + 7. `classifyTransferLog(log, rubyAddress)` signature (Task 6) matches its call in `parseBlocks` and in `main.ts` (`env.INDEXER_RUBY_ADDRESS`). `events.Transfer.topic` used identically across Tasks 3/5/6. Transfer `id` scheme `${blockNumber}-${logIndex}` is consistent between schema comments (Task 4) and inserts (Task 7).

**Refinements noted vs. spec:**

- The indexer has **no `@repo/lib` runtime dependency** (inlines `ZERO_ADDRESS`, lowercases inline). This keeps the CommonJS Subsquid app free of ESM-TS-source-at-runtime resolution issues and matches how the reference indexer stays self-contained. The address/piece helpers in `@repo/lib` are used by the (future) worker/website, not the indexer.
- Transfer primary keys use the **deterministic** `${blockNumber}-${logIndex}` (reorg-safe, replayable) instead of the reference's random uuid, dropping the uuid dependency.
- `edition`/`symbol` come from on-chain `name()`/`symbol()` (spec §5 says `piece_collection.edition = contract name()`); TopPort's richer edition/class metadata is layered on later by the worker into the app-owned `piece_design_meta`, not into the indexer-owned `piece_collection`.
