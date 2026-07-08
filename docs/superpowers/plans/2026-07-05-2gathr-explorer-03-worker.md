# 2GATHR Explorer — Plan 3: Enrichment Worker (Phase 1b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/worker` — a cron-scheduled Node service that turns the indexer's raw on-chain tables into a browsable dataset: it enriches each auto-registered Piece collection with design metadata + class from the **public TopPort catalog** (writing `piece_design_meta`), and recomputes rollups (Ruby balances, holder counts, class distribution, global totals) into `rollup_stat`.

**Architecture:** A standalone ESM Node app run with `tsx`, scheduled with `croner` — each job runs once on startup and then on a cron interval. Jobs read the **indexer** database read-only (via `@repo/db`'s `indexer` client + `indexerSchema`) and write the **app** database (via `@repo/db`'s `db` client + app `schema`). Design enrichment uses a new **TopPort catalog client** added to `@repo/2gathr` (`api.topport.io` → contract-address → class/edition/member/#/media), keyed by `boxContractAddress`; the indexer's on-chain `pieceCollection.edition` is the always-present fallback for the NOT-NULL `edition`. No IPFS/RPC fetching and no media mirroring in this slice — `piece_design_meta` stores the IPFS/TopPort **source URLs** directly (own-CDN mirroring is a later plan). No Valkey/queue dependency (cron-driven).

**Tech Stack:** Node + TypeScript 7 rc (run via `tsx`), `croner` (cron scheduler), `@dotenvx/dotenvx` (env), Drizzle (`@repo/db` clients), `ofetch`/`zod` (TopPort client in `@repo/2gathr`), Vitest.

## Global Constraints

- Package manager: **pnpm@11** (use `pnpm` for every command, never npm/yarn/bun). Node runtime (no Bun).
- **Dependency versions live in pnpm catalogs** (`pnpm-workspace.yaml`): use `catalog:` / `catalog:dev`, never pin a version in a `package.json`. New deps are added to the catalog first (Task 1).
- **Internal deps** use `workspace:*`. Internal names: `@repo/{tsconfig,lint,lib,db,2gathr}`.
- **ESM + `nodenext` + `.js` extensions**: `apps/worker` and `@repo/2gathr` are ESM packages (`"type":"module"`) — every relative import carries a `.js` extension (`import { x } from "./thing.js"`). Package imports (`@repo/…`) stay bare. (This is the normal repo convention — unlike `apps/indexer`, which is the CommonJS exception.)
- Lint = `oxlint --type-aware`; format = `oxfmt`. A clean oxlint run prints nothing and exits 0 — check the exit code, not stdout. Unused vars are enforced by tsc's `noUnusedLocals` (repo default).
- **Two databases, never crossed**: the worker WRITES only the app database (`DATABASE_URL`, pooled 5433) and READS the indexer database read-only (`INDEXER_DATABASE_URL`, pooled 5435). Never write indexer tables.
- **TDD**: failing test → minimal impl → passing test. Tests assert real behavior. Pure functions (`parseTopportBox`, `computeRubyBalances`, `computeClassDistribution`) are TDD'd; DB/HTTP wiring is verified by a live run.
- **Enrichment source of truth**: the **public** TopPort catalog `GET https://api.topport.io/api/service/mysterybox` (list) + `/{id}` (detail → `boxContractAddress`, `rarityLevel`, `title`, `mysteryboxItems[]`), filtered to `chainId 84358`. IPFS `tokenURI` / RPC fallback is **out of scope** for this slice.
- **Catalog membership defines a real, listed design.** Contracts **absent** from the TopPort catalog are pre-launch/test deploys (verified: exactly 4 `2025 Season 1` contracts, each single-minted to deployer `0x5116…4bfd` on 2025-10-13, never listed — see the findings doc). The enrich job **skips them — no `piece_design_meta` row is written.** So `piece_design_meta` is exactly the set of app-listed designs; the website lists designs **from `piece_design_meta`** (the natural inner-join against on-chain `piece_collection` — realized in app code, since the two live in separate databases), which makes counts match the 2GATHR app (e.g. 54, not the raw on-chain 58, for `2025 Season 1`). Unlisted contracts stay indexed on-chain and are retried on every enrich run, so any that later get listed auto-enrich. No `listed` column needed.
- **No media mirroring** in this slice: `piece_design_meta.imageUrl/thumbnailUrl/animationUrl` store the source IPFS(Pinata)/TopPort-S3 URLs verbatim. `classLetter` stays `null` (the int→letter mapping is still unconfirmed — see the findings doc).
- Class = `rarityLevel` integer (store raw). Members are title-cased via `normalizeMember` from `@repo/lib`.
- Commit after every task with a Conventional Commit message.

---

### Task 1: Add worker deps to the pnpm catalog

**Files:**

- Modify: `pnpm-workspace.yaml`

**Interfaces:**

- Produces (new `catalog:` entries): `croner`. (`ofetch`, `zod`, `drizzle-orm`, `pg` already present.)
- Produces (new `catalog:dev` entries): `tsx`. (`@dotenvx/dotenvx`, `typescript`, `turbo`, `vitest`, `@types/node`, `@types/pg` already present.)

- [ ] **Step 1: Add the runtime catalog entry**

In `pnpm-workspace.yaml`, add to the top-level `catalog:` block (keep existing keys):

```yaml
croner: ^9.0.0
```

- [ ] **Step 2: Add the dev catalog entry**

Add to the `catalogs.dev` block (keep existing keys):

```yaml
tsx: ^4.20.0
```

- [ ] **Step 3: Verify the workspace file still parses**

Run: `pnpm install`
Expected: completes without a YAML/catalog error. (If a pinned version fails to resolve on the registry, bump it to the nearest published version and note it.)

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: add worker deps (croner, tsx) to pnpm catalog"
```

---

### Task 2: TopPort catalog client + `parseTopportBox` in `@repo/2gathr` (TDD)

**Files:**

- Create: `packages/2gathr/src/types/topport.ts`
- Create: `packages/2gathr/src/topport.ts`
- Create: `packages/2gathr/src/topport.test.ts`
- Modify: `packages/2gathr/src/index.ts`

**Interfaces:**

- Consumes: `@repo/lib` (`parsePieceName`, `normalizeMember`), `ofetch`, `zod`.
- Produces:
  - `topportBoxSchema` (zod) + `type TopportBox = z.infer<typeof topportBoxSchema>` — a **lenient** parse of a mysterybox **detail** (`.passthrough()`, most fields optional).
  - `interface ParsedTopportDesign { contractAddress: string | null; member: string | null; designNumber: number | null; rarity: number; edition: string; imageUrl: string; thumbnailUrl: string | null; animationUrl: string | null; mediaType: string; isHidden: boolean }`
  - `parseTopportBox(box: TopportBox, fallbackEdition: string): ParsedTopportDesign` — pure mapping (member/# via `parsePieceName` on the first item's `name`; class = `rarityLevel`; edition = `title.en` else `fallbackEdition`; URLs from the first item; `contractAddress` lowercased).
  - `createTopportClient(baseURL: string)` — an `ofetch` instance.
  - `listMysteryboxIds(client): Promise<number[]>` — pages the public list (`?isCollection=true&chainId=84358&limit=300`), returns the collection ids.
  - `getMysterybox(client, id: number): Promise<TopportBox>` — fetches + parses one detail.
  - `buildContractCatalog(client, chainId?: number): Promise<Map<string, TopportBox>>` — list → per-id detail → `Map<lowercaseContractAddress, TopportBox>` (only rows with a `boxContractAddress`).

- [ ] **Step 1: Create `packages/2gathr/src/types/topport.ts`**

```typescript
import { z } from "zod";

// Localized title can be an object {en, ko} (list/detail) or occasionally a bare string.
const localizedTitleSchema = z.union([
  z.string(),
  z.object({ en: z.string().optional(), ko: z.string().optional() }).partial(),
]);

export function titleText(title: z.infer<typeof localizedTitleSchema> | undefined): string {
  if (!title) return "";
  if (typeof title === "string") return title;
  return title.en || title.ko || "";
}

export const topportBoxItemSchema = z
  .object({
    no: z.number().optional(),
    name: z.string().optional().default(""),
    originalImage: z.string().optional().default(""),
    itemImage: z.string().optional().default(""),
    imageLink: z.string().optional().default(""),
    metaLink: z.string().optional().default(""),
  })
  .passthrough();

// Detail response (GET /api/service/mysterybox/{id}). Lenient: TopPort may add/rename
// fields; unknowns pass through and are preserved in raw metadata by callers.
export const topportBoxSchema = z
  .object({
    id: z.number(),
    title: localizedTitleSchema.optional(),
    rarityLevel: z.number().optional().default(0),
    boxContractAddress: z.string().nullish(),
    chainId: z.number().optional(),
    totalAmount: z.number().optional(),
    usedAmount: z.number().optional(),
    mysteryboxItems: z.array(topportBoxItemSchema).optional().default([]),
  })
  .passthrough();

export type TopportBox = z.infer<typeof topportBoxSchema>;
```

- [ ] **Step 2: Write the failing test `packages/2gathr/src/topport.test.ts`**

Fixture mirrors the inspected detail shape (see `docs/superpowers/research/2gathr-api-findings.md`).

```typescript
import { describe, expect, it } from "vitest";

import { parseTopportBox } from "./topport";
import { topportBoxSchema } from "./types/topport";

const BOX_258 = {
  id: 258,
  title: { en: "2026 Season 3", ko: "" },
  rarityLevel: 3,
  boxContractAddress: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
  chainId: 84358,
  totalAmount: 10000,
  usedAmount: 0,
  mysteryboxItems: [
    {
      no: 1,
      name: "BOME #022",
      originalImage: "https://topport.s3.ap-northeast-2.amazonaws.com/item/BOME%20%23022.png",
      itemImage:
        "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/BOME%20%23022.jpeg",
      imageLink: "https://gateway.pinata.cloud/ipfs/bafyimg258",
      metaLink: "https://gateway.pinata.cloud/ipfs/Qmmeta258",
    },
  ],
};

describe("topportBoxSchema", () => {
  it("leniently parses a detail with unknown extra fields", () => {
    const box = topportBoxSchema.parse({ ...BOX_258, someFutureField: true });
    expect(box.boxContractAddress).toBe("0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884");
    expect(box.rarityLevel).toBe(3);
  });
});

describe("parseTopportBox", () => {
  it("maps a box to a ParsedTopportDesign", () => {
    const box = topportBoxSchema.parse(BOX_258);
    const d = parseTopportBox(box, "2026 Season 3 (fallback)");
    expect(d.contractAddress).toBe("0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884");
    expect(d.member).toBe("Bome");
    expect(d.designNumber).toBe(22);
    expect(d.rarity).toBe(3);
    expect(d.edition).toBe("2026 Season 3");
    expect(d.imageUrl).toContain("ipfs/bafyimg258");
    expect(d.thumbnailUrl).toContain("topport");
    expect(d.mediaType).toBe("png");
    expect(d.isHidden).toBe(false);
  });

  it("falls back to the provided edition when title is empty", () => {
    const box = topportBoxSchema.parse({ ...BOX_258, title: { en: "" } });
    const d = parseTopportBox(box, "Welcome");
    expect(d.edition).toBe("Welcome");
  });

  it("returns nulls for member/design when the item name is non-standard", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [{ name: "Welcome to 2GATHR", imageLink: "https://x/y.png" }],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.member).toBeNull();
    expect(d.designNumber).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @repo/2gathr test`
Expected: FAIL — cannot resolve `./topport`.

- [ ] **Step 4: Implement `packages/2gathr/src/topport.ts`**

```typescript
import { normalizeMember, parsePieceName } from "@repo/lib";
import { ofetch } from "ofetch";

import { type TopportBox, titleText, topportBoxSchema } from "./types/topport.js";

const TITAN_CHAIN_ID = 84358;

export interface ParsedTopportDesign {
  contractAddress: string | null;
  member: string | null;
  designNumber: number | null;
  rarity: number;
  edition: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  animationUrl: string | null;
  mediaType: string;
  isHidden: boolean;
}

function extension(url: string): string {
  const clean = url.split("?")[0] ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match?.[1]?.toLowerCase() ?? "";
}

export function parseTopportBox(box: TopportBox, fallbackEdition: string): ParsedTopportDesign {
  const item = box.mysteryboxItems[0];
  const name = item?.name ?? "";
  const parsed = parsePieceName(name);
  const imageUrl = item?.imageLink || item?.originalImage || "";
  const originalExt = extension(item?.originalImage ?? "");

  return {
    contractAddress: box.boxContractAddress ? box.boxContractAddress.toLowerCase() : null,
    member: parsed.member ? normalizeMember(parsed.member) : null,
    designNumber: parsed.designNumber,
    rarity: box.rarityLevel ?? 0,
    edition: titleText(box.title) || fallbackEdition,
    imageUrl,
    thumbnailUrl: item?.itemImage || null,
    // best-effort: TopPort serves 3D pieces as an mp4 in originalImage
    animationUrl: originalExt === "mp4" ? (item?.originalImage ?? null) : null,
    mediaType: extension(imageUrl),
    isHidden: parsed.hidden,
  };
}

export function createTopportClient(baseURL: string) {
  return ofetch.create({ baseURL, retry: 2, timeout: 20_000 });
}

type OFetchClient = ReturnType<typeof createTopportClient>;

// The list may be wrapped as { data: { list: [...] } } or returned bare; handle both.
export async function listMysteryboxIds(
  client: OFetchClient,
  chainId = TITAN_CHAIN_ID,
): Promise<number[]> {
  const body = (await client("/api/service/mysterybox", {
    query: { isCollection: true, chainId, page: 1, limit: 300, sortBy: "createdAt:ASC" },
  })) as { data?: { list?: unknown[] }; list?: unknown[] };
  const list = body.data?.list ?? body.list ?? [];
  const ids: number[] = [];
  for (const raw of list) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "number") ids.push(id);
  }
  return ids;
}

export async function getMysterybox(client: OFetchClient, id: number): Promise<TopportBox> {
  const body = (await client(`/api/service/mysterybox/${id}`)) as { data?: unknown };
  return topportBoxSchema.parse(body.data ?? body);
}

// Fetch the whole catalog and index it by lowercase on-chain contract address.
export async function buildContractCatalog(
  client: OFetchClient,
  chainId = TITAN_CHAIN_ID,
): Promise<Map<string, TopportBox>> {
  const ids = await listMysteryboxIds(client, chainId);
  const map = new Map<string, TopportBox>();
  for (const id of ids) {
    try {
      const box = await getMysterybox(client, id);
      if (box.boxContractAddress) {
        map.set(box.boxContractAddress.toLowerCase(), box);
      }
    } catch {
      // skip boxes that fail to parse/fetch; the enrich job logs the miss per-contract
    }
  }
  return map;
}
```

- [ ] **Step 5: Update `packages/2gathr/src/index.ts`**

```typescript
export * from "./metadata.js";
export * from "./http.js";
export * from "./topport.js";
export * from "./types/metadata.js";
export * from "./types/topport.js";
```

- [ ] **Step 6: Run tests + typecheck + lint**

Run: `pnpm --filter @repo/2gathr test && pnpm --filter @repo/2gathr typecheck && pnpm --filter @repo/2gathr lint`
Expected: all `parseTopportBox` / schema tests PASS; typecheck exits 0; lint exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/2gathr/src
git commit -m "feat(2gathr): add TopPort catalog client + parseTopportBox"
```

---

### Task 3: Scaffold the `apps/worker` package

**Files:**

- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/oxlint.config.ts`
- Create: `apps/worker/turbo.json`
- Create: `apps/worker/vitest.config.ts`
- Create: `apps/worker/.gitignore`
- Create: `apps/worker/src/env.ts`

**Interfaces:**

- Consumes: `.env` vars `DATABASE_URL`, `INDEXER_DATABASE_URL` (already in `.env.example`), plus new `TOPPORT_BASE_URL` (default `https://api.topport.io`).
- Produces: `env` exported from `apps/worker/src/env.ts` — fields `env.DATABASE_URL`, `env.INDEXER_DATABASE_URL`, `env.TOPPORT_BASE_URL`.

- [ ] **Step 1: Create `apps/worker/package.json`**

ESM (`"type":"module"`). Run with `tsx` via `dotenvx` (loads the root `.env`), mirroring the indexer's env-loading approach.

```json
{
  "name": "worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "dotenvx run -f ../../.env -- tsx watch src/index.ts",
    "start": "dotenvx run -f ../../.env -- tsx src/index.ts",
    "enrich:once": "dotenvx run -f ../../.env -- tsx src/run-once.ts enrich",
    "rollups:once": "dotenvx run -f ../../.env -- tsx src/run-once.ts rollups",
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
    "typecheck": "tsc --noEmit",
    "format": "oxfmt .",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/2gathr": "workspace:*",
    "@repo/db": "workspace:*",
    "@repo/lib": "workspace:*",
    "croner": "catalog:",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@dotenvx/dotenvx": "catalog:dev",
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "tsx": "catalog:dev",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 2: Create `apps/worker/tsconfig.json`**

```json
{
  "extends": "@repo/tsconfig/tsconfig.node.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/worker/oxlint.config.ts`**

```typescript
import config from "@repo/lint/oxlint.config";

export default config;
```

- [ ] **Step 4: Create `apps/worker/turbo.json`**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {}
}
```

- [ ] **Step 5: Create `apps/worker/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 6: Create `apps/worker/.gitignore`**

```
.turbo/
dist/
```

- [ ] **Step 7: Create `apps/worker/src/env.ts`**

```typescript
import * as z from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  INDEXER_DATABASE_URL: z.url(),
  TOPPORT_BASE_URL: z.url().default("https://api.topport.io"),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 8: Add `TOPPORT_BASE_URL` to `.env.example`**

Add under a new worker section of `.env.example`:

```
# ---- worker (enrichment) ----
TOPPORT_BASE_URL="https://api.topport.io"
```

- [ ] **Step 9: Install + typecheck the skeleton**

Run: `pnpm install`
Run: `pnpm --filter worker typecheck`
Expected: install resolves `croner`/`tsx`; typecheck exits 0 (only `env.ts` exists).

- [ ] **Step 10: Commit**

```bash
git add apps/worker .env.example pnpm-lock.yaml
git commit -m "chore(worker): scaffold apps/worker package + env"
```

---

### Task 4: `enrich-collections` job + live verification

**Files:**

- Create: `apps/worker/src/jobs/enrich-collections.ts`
- Create: `apps/worker/src/run-once.ts`

**Interfaces:**

- Consumes: `@repo/db` (`db`), `@repo/db/indexer` (`indexer`, `indexerSchema`), `@repo/db/schema` (`pieceDesignMeta`), `@repo/2gathr` (`createTopportClient`, `buildContractCatalog`, `parseTopportBox`), `env`.
- Produces:
  - `enrichCollections(): Promise<{ enriched: number; unlisted: number; alreadyEnriched: number }>` — upsert `piece_design_meta` for every indexer `pieceCollection` that is present in the TopPort catalog and lacks a row; catalog-absent (unlisted/test) contracts are skipped (no row written).
  - `run-once.ts` — a CLI entry (`tsx src/run-once.ts enrich|rollups`) that runs one job and exits, for verification + the `enrich:once`/`rollups:once` scripts.

- [ ] **Step 1: Create `apps/worker/src/jobs/enrich-collections.ts`**

```typescript
import { buildContractCatalog, createTopportClient, parseTopportBox } from "@repo/2gathr";
import { db } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { pieceDesignMeta } from "@repo/db/schema";

import { env } from "../env.js";

// Enrich every indexer collection that has no piece_design_meta row yet, using the
// public TopPort catalog. Contracts absent from the catalog get a minimal row keyed
// on the indexer's on-chain edition so the NOT-NULL edition is always satisfied.
export async function enrichCollections(): Promise<{ enriched: number; skipped: number }> {
  const collections = await indexer
    .select({
      contract: indexerSchema.pieceCollection.id,
      edition: indexerSchema.pieceCollection.edition,
    })
    .from(indexerSchema.pieceCollection);

  const existing = await db
    .select({ contract: pieceDesignMeta.contractAddress })
    .from(pieceDesignMeta);
  const enrichedSet = new Set(existing.map((r) => r.contract.toLowerCase()));

  const todo = collections.filter((c) => !enrichedSet.has(c.contract.toLowerCase()));
  if (todo.length === 0) {
    return { enriched: 0, unlisted: 0, alreadyEnriched: collections.length };
  }

  const client = createTopportClient(env.TOPPORT_BASE_URL);
  const catalog = await buildContractCatalog(client);

  const now = new Date().toISOString();
  let enriched = 0;
  let unlisted = 0;

  for (const c of todo) {
    const box = catalog.get(c.contract.toLowerCase());
    if (!box) {
      // Absent from the TopPort catalog = pre-launch/test/unlisted deploy. Skip it:
      // piece_design_meta stays exactly the set of app-listed designs, so the website's
      // design list (driven off piece_design_meta) matches the 2GATHR app. It's retried
      // on the next run and auto-enriches if the contract is ever added to the catalog.
      console.warn(`[enrich] ${c.contract} not in TopPort catalog (unlisted/test) — skipping`);
      unlisted++;
      continue;
    }
    const row = topportRow(c.contract, c.edition, box, now);
    await db
      .insert(pieceDesignMeta)
      .values(row)
      .onConflictDoUpdate({ target: pieceDesignMeta.contractAddress, set: row });
    enriched++;
  }

  return { enriched, unlisted, alreadyEnriched: collections.length - todo.length };
}

function topportRow(
  contract: string,
  fallbackEdition: string,
  box: Parameters<typeof parseTopportBox>[0],
  now: string,
) {
  const d = parseTopportBox(box, fallbackEdition);
  return {
    contractAddress: contract.toLowerCase(),
    member: d.member,
    designNumber: d.designNumber,
    edition: d.edition,
    rarity: d.rarity,
    classLetter: null,
    imageUrl: d.imageUrl || null,
    thumbnailUrl: d.thumbnailUrl,
    animationUrl: d.animationUrl,
    mediaType: d.mediaType || null,
    isHidden: d.isHidden,
    rawMetadata: box,
    fetchedAt: now,
  };
}
```

- [ ] **Step 2: Create `apps/worker/src/run-once.ts`**

```typescript
import { enrichCollections } from "./jobs/enrich-collections.js";

const job = process.argv[2];

async function main() {
  if (job === "enrich") {
    const result = await enrichCollections();
    console.log(
      `[enrich] done: enriched=${result.enriched} unlisted=${result.unlisted} alreadyEnriched=${result.alreadyEnriched}`,
    );
  } else {
    console.error(`unknown job: ${job ?? "(none)"} — expected "enrich" or "rollups"`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter worker typecheck && pnpm --filter worker lint`
Expected: both exit 0.

- [ ] **Step 4: Live verification against the populated indexer DB + real TopPort catalog**

Preconditions: the dev stack is up (`docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer`), the indexer DB has collections (from Plan 2's backfill), the app DB `main` has the `piece_design_meta` table (Foundation `db:push`), and root `.env` has `DATABASE_URL`, `INDEXER_DATABASE_URL`, `TOPPORT_BASE_URL`.

Run: `pnpm --filter worker enrich:once`
Expected: logs `[enrich] done: enriched=N unlisted=U alreadyEnriched=…` with `N > 0` and no unhandled errors. `not in TopPort catalog (unlisted/test)` warnings are expected for pre-launch/test deploys (e.g. the 4 known `2025 Season 1` test contracts) — those get **no** `piece_design_meta` row by design.

Verify the rows landed with real classes/editions/members:

Run: `docker compose exec postgres psql -U postgres -d main -c "select count(*) from piece_design_meta; select contract_address, member, design_number, edition, rarity, is_hidden from piece_design_meta where member is not null order by edition limit 8;"`
Expected: non-zero count; sample rows show a populated `edition`, an integer `rarity`, and title-cased `member` (e.g. `Bome`) with a `design_number`.

Verify the enriched set matches the app (listed designs only) — `2025 Season 1` should be **54**, and the 4 known test contracts must be **absent**:

Run: `docker compose exec postgres psql -U postgres -d main -c "select edition, count(*) from piece_design_meta group by edition order by edition; select count(*) as should_be_zero from piece_design_meta where contract_address in ('0x76e79fbf6e2eb5b05187ab79170f25aacf6f9858','0x98c126c37e76a1cc05f3aab8e82d06fcd7f899e7','0xb937d442e5e2b1e974661340dc0ef122e45c7c16','0xa105cf3d80c1d71a75e624dd943e3339f44d0ec9');"`
Expected: `2025 Season 1 → 54` (not 58); `should_be_zero → 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src
git commit -m "feat(worker): enrich piece collections from the TopPort catalog"
```

---

### Task 5: `recompute-rollups` job (Ruby balances + class distribution + holders + summary)

**Files:**

- Create: `apps/worker/src/rollups/compute.ts`
- Create: `apps/worker/src/rollups/compute.test.ts`
- Create: `apps/worker/src/jobs/recompute-rollups.ts`
- Modify: `apps/worker/src/run-once.ts` (wire the `rollups` job)

**Interfaces:**

- Consumes: `@repo/db` (`db`), `@repo/db/indexer` (`indexer`, `indexerSchema`), `@repo/db/schema` (`pieceDesignMeta`, `rollupStat`), `@repo/lib` (`ZERO_ADDRESS`), drizzle (`sql`, `ne`, `count`, `countDistinct`).
- Produces:
  - Pure: `computeRubyBalances(transfers: { from: string; to: string; value: bigint }[]): Map<string, bigint>` — folds transfers into per-address balances, excludes the zero address, drops zero balances.
  - Pure: `computeClassDistribution(designs: { rarity: number | null }[]): Record<string, number>` — count of designs per class (null classes under key `"unknown"`).
  - `recomputeRollups(): Promise<void>` — writes `rollup_stat` rows: `ruby_balance/{address}`, `class_distribution/global`, `collection_holders/{contract}`, `global_stats/summary`.

- [ ] **Step 1: Write the failing test `apps/worker/src/rollups/compute.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { computeClassDistribution, computeRubyBalances } from "./compute";

const ZERO = "0x0000000000000000000000000000000000000000";
const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

describe("computeRubyBalances", () => {
  it("folds mints and transfers, excluding the zero address and zero balances", () => {
    const balances = computeRubyBalances([
      { from: ZERO, to: A, value: 100n }, // mint 100 to A
      { from: ZERO, to: B, value: 50n }, // mint 50 to B
      { from: A, to: B, value: 30n }, // A -> B 30
      { from: B, to: ZERO, value: 80n }, // B burns 80
    ]);
    expect(balances.get(A)).toBe(70n); // 100 - 30
    expect(balances.get(B)).toBeUndefined(); // 50 + 30 - 80 = 0 -> dropped
    expect(balances.has(ZERO)).toBe(false);
  });

  it("keeps a positive residual balance", () => {
    const balances = computeRubyBalances([
      { from: ZERO, to: A, value: 100n },
      { from: A, to: B, value: 40n },
    ]);
    expect(balances.get(A)).toBe(60n);
    expect(balances.get(B)).toBe(40n);
  });
});

describe("computeClassDistribution", () => {
  it("counts designs per class, bucketing nulls as unknown", () => {
    expect(
      computeClassDistribution([{ rarity: 1 }, { rarity: 1 }, { rarity: 3 }, { rarity: null }]),
    ).toEqual({ "1": 2, "3": 1, unknown: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter worker test`
Expected: FAIL — cannot resolve `./compute`.

- [ ] **Step 3: Implement `apps/worker/src/rollups/compute.ts`**

```typescript
import { ZERO_ADDRESS } from "@repo/lib";

export function computeRubyBalances(
  transfers: { from: string; to: string; value: bigint }[],
): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  const add = (addr: string, delta: bigint) => {
    if (addr === ZERO_ADDRESS) return;
    balances.set(addr, (balances.get(addr) ?? 0n) + delta);
  };
  for (const t of transfers) {
    add(t.from, -t.value);
    add(t.to, t.value);
  }
  for (const [addr, bal] of balances) {
    if (bal === 0n) balances.delete(addr);
  }
  return balances;
}

export function computeClassDistribution(
  designs: { rarity: number | null }[],
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const d of designs) {
    const key = d.rarity === null ? "unknown" : String(d.rarity);
    dist[key] = (dist[key] ?? 0) + 1;
  }
  return dist;
}
```

- [ ] **Step 4: Run to verify the pure tests pass**

Run: `pnpm --filter worker test`
Expected: `computeRubyBalances` + `computeClassDistribution` tests PASS.

- [ ] **Step 5: Implement `apps/worker/src/jobs/recompute-rollups.ts`**

```typescript
import { db } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { pieceDesignMeta, rollupStat } from "@repo/db/schema";
import { ZERO_ADDRESS } from "@repo/lib";
import { count, countDistinct, ne } from "drizzle-orm";

import { computeClassDistribution, computeRubyBalances } from "../rollups/compute.js";

async function putRollup(scope: string, key: string, value: unknown) {
  const row = { scope, key, value, updatedAt: new Date().toISOString() };
  await db
    .insert(rollupStat)
    .values(row)
    .onConflictDoUpdate({ target: [rollupStat.scope, rollupStat.key], set: row });
}

export async function recomputeRollups(): Promise<void> {
  // ---- Ruby balances (fold every ruby_transfer in JS) ----
  const rubyRows = await indexer
    .select({
      from: indexerSchema.rubyTransfer.from,
      to: indexerSchema.rubyTransfer.to,
      value: indexerSchema.rubyTransfer.value,
    })
    .from(indexerSchema.rubyTransfer);
  const balances = computeRubyBalances(
    rubyRows.map((r) => ({ from: r.from, to: r.to, value: BigInt(r.value) })),
  );
  for (const [address, balance] of balances) {
    await putRollup("ruby_balance", address, { balance: balance.toString() });
  }

  // ---- Class distribution (from enriched designs) ----
  const designs = await db.select({ rarity: pieceDesignMeta.rarity }).from(pieceDesignMeta);
  await putRollup("class_distribution", "global", computeClassDistribution(designs));

  // ---- Holder counts per collection (distinct non-zero owners) ----
  const holders = await indexer
    .select({
      contract: indexerSchema.pieceToken.contractAddress,
      holders: countDistinct(indexerSchema.pieceToken.owner),
      supply: count(),
    })
    .from(indexerSchema.pieceToken)
    .where(ne(indexerSchema.pieceToken.owner, ZERO_ADDRESS))
    .groupBy(indexerSchema.pieceToken.contractAddress);
  for (const h of holders) {
    await putRollup("collection_holders", h.contract, {
      holders: Number(h.holders),
      supply: Number(h.supply),
    });
  }

  // ---- Global summary ----
  // "collections" = app-listed designs: piece_design_meta only holds cataloged designs,
  // so the headline matches the 2GATHR app (e.g. excludes the 4 unlisted test contracts),
  // not the raw on-chain piece_collection set. tokens/transfers stay raw on-chain totals.
  const [{ collections }] = await db.select({ collections: count() }).from(pieceDesignMeta);
  const [{ tokens }] = await indexer.select({ tokens: count() }).from(indexerSchema.pieceToken);
  const [{ transfers }] = await indexer
    .select({ transfers: count() })
    .from(indexerSchema.pieceTransfer);
  const [{ rubyTransfers }] = await indexer
    .select({ rubyTransfers: count() })
    .from(indexerSchema.rubyTransfer);
  await putRollup("global_stats", "summary", {
    collections: Number(collections),
    tokens: Number(tokens),
    transfers: Number(transfers),
    rubyTransfers: Number(rubyTransfers),
    rubyHolders: balances.size,
    computedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 6: Wire the `rollups` job into `apps/worker/src/run-once.ts`**

Replace the file with:

```typescript
import { enrichCollections } from "./jobs/enrich-collections.js";
import { recomputeRollups } from "./jobs/recompute-rollups.js";

const job = process.argv[2];

async function main() {
  if (job === "enrich") {
    const result = await enrichCollections();
    console.log(
      `[enrich] done: enriched=${result.enriched} unlisted=${result.unlisted} alreadyEnriched=${result.alreadyEnriched}`,
    );
  } else if (job === "rollups") {
    await recomputeRollups();
    console.log("[rollups] done");
  } else {
    console.error(`unknown job: ${job ?? "(none)"} — expected "enrich" or "rollups"`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Typecheck + lint + unit tests**

Run: `pnpm --filter worker typecheck && pnpm --filter worker lint && pnpm --filter worker test`
Expected: all exit 0 / PASS.

- [ ] **Step 8: Live verification**

Run: `pnpm --filter worker rollups:once`
Expected: logs `[rollups] done` with no errors.

Verify the rollup rows:

Run: `docker compose exec postgres psql -U postgres -d main -c "select scope, count(*) from rollup_stat group by scope order by scope; select value from rollup_stat where scope='global_stats' and key='summary';"`
Expected: rows for `collection_holders`, `class_distribution`, `global_stats`, `ruby_balance`; the summary JSON shows non-zero `collections`/`tokens`/`transfers`/`rubyTransfers` matching the indexer DB.

- [ ] **Step 9: Commit**

```bash
git add apps/worker/src
git commit -m "feat(worker): recompute ruby balances, grade distribution, holders, summary"
```

---

### Task 6: Cron scheduler entrypoint + refresh mode + graceful shutdown

**Files:**

- Create: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/jobs/enrich-collections.ts` (add a `refreshStale` variant)

**Interfaces:**

- Consumes: `croner` (`Cron`), the two jobs, `env`.
- Produces: `apps/worker/src/index.ts` — the long-running scheduler (runs each job once on startup, then on a cron interval), plus a `refreshStaleCollections(maxAgeMs)` re-enrichment pass.

- [ ] **Step 1: Add `refreshStaleCollections` to `apps/worker/src/jobs/enrich-collections.ts`**

Append to the file (re-uses the same TopPort catalog + row builders; re-enriches rows whose `fetchedAt` is older than `maxAgeMs`, picking up updated catalog data):

```typescript
import { lt } from "drizzle-orm";

// Re-enrich designs whose piece_design_meta.fetchedAt is older than maxAgeMs.
export async function refreshStaleCollections(maxAgeMs: number): Promise<{ refreshed: number }> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const stale = await db
    .select({ contract: pieceDesignMeta.contractAddress })
    .from(pieceDesignMeta)
    .where(lt(pieceDesignMeta.fetchedAt, cutoff));
  if (stale.length === 0) return { refreshed: 0 };

  const editionByContract = new Map(
    (
      await indexer
        .select({
          contract: indexerSchema.pieceCollection.id,
          edition: indexerSchema.pieceCollection.edition,
        })
        .from(indexerSchema.pieceCollection)
    ).map((c) => [c.contract.toLowerCase(), c.edition]),
  );

  const client = createTopportClient(env.TOPPORT_BASE_URL);
  const catalog = await buildContractCatalog(client);
  const now = new Date().toISOString();
  let refreshed = 0;

  for (const s of stale) {
    const contract = s.contract.toLowerCase();
    const box = catalog.get(contract);
    if (!box) continue; // keep the existing row if the catalog can't improve it
    const row = topportRow(contract, editionByContract.get(contract) ?? "", box, now);
    await db
      .insert(pieceDesignMeta)
      .values(row)
      .onConflictDoUpdate({ target: pieceDesignMeta.contractAddress, set: row });
    refreshed++;
  }
  return { refreshed };
}
```

> Add the `lt` import to the existing `drizzle-orm` import line at the top of the file (the file currently imports nothing from `drizzle-orm`; add `import { lt } from "drizzle-orm";`). `topportRow` and the module-level `db`/`indexer`/`indexerSchema`/`createTopportClient`/`buildContractCatalog`/`env`/`pieceDesignMeta` are already in scope from Task 4/5 — do not redeclare them.

- [ ] **Step 2: Create `apps/worker/src/index.ts`**

```typescript
import { Cron } from "croner";

import { enrichCollections, refreshStaleCollections } from "./jobs/enrich-collections.js";
import { recomputeRollups } from "./jobs/recompute-rollups.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const crons: Cron[] = [];

async function safe(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`[${name}] ok`, result ?? "");
  } catch (err) {
    console.error(`[${name}] failed:`, err);
  }
}

// startup pass
await safe("enrich", enrichCollections);
await safe("rollups", recomputeRollups);

// pick up newly auto-registered collections every 5 minutes
crons.push(new Cron("*/5 * * * *", () => safe("enrich", enrichCollections)));
// recompute rollups every 10 minutes
crons.push(new Cron("*/10 * * * *", () => safe("rollups", recomputeRollups)));
// re-enrich designs older than a day, hourly (picks up updated catalog data)
crons.push(new Cron("0 * * * *", () => safe("refresh", () => refreshStaleCollections(ONE_DAY_MS))));

console.log(`[worker] started with ${crons.length} scheduled jobs`);

function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, stopping ${crons.length} jobs`);
  for (const cron of crons) cron.stop();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter worker typecheck && pnpm --filter worker lint`
Expected: both exit 0.

- [ ] **Step 4: Verify the scheduler boots, runs the startup pass, and shuts down cleanly**

Run (start, let the startup pass run, then stop):

```bash
cd apps/worker && pnpm start > /tmp/worker-boot.log 2>&1 &
WPID=$!
sleep 25
kill -INT $WPID 2>/dev/null || true
cd ../..
tail -n 20 /tmp/worker-boot.log
```

Expected: log shows `[enrich] ok`, `[rollups] ok`, `[worker] started with 3 scheduled jobs`, and on the INT signal a clean `[worker] SIGINT received, stopping 3 jobs` — no unhandled errors.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src
git commit -m "feat(worker): cron scheduler + hourly stale-design refresh"
```

---

### Task 7: Workspace verification gate + docs refresh

**Files:**

- Modify: `AGENTS.md` (Layout + Status: worker built)

- [ ] **Step 1: Install clean**

Run: `pnpm install`
Expected: no errors; lockfile stable.

- [ ] **Step 2: Typecheck + lint + test everything**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all packages exit 0; the new `@repo/2gathr` TopPort tests + `worker` rollup tests PASS alongside the existing suites.

- [ ] **Step 3: Format check**

Run: `pnpm exec oxfmt --check .`
Expected: clean (run `pnpm format` + re-commit if not).

- [ ] **Step 4: Update `AGENTS.md`**

In the Layout `apps/` line, change `worker (planned)` to `worker (built)`. In the `## Status` section, update to note the worker is complete and the **website** is next. (Match the existing wording style.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(worker): workspace verification gate + docs"
```

---

## Self-Review

**1. Spec coverage (spec §7 Worker + API-findings enrichment strategy):**

- `register-collection` (read one collection's metadata, parse member/designNumber/class/edition/hidden, upsert `piece_design_meta`) → Task 4 `enrichCollections`, sourced from the TopPort catalog (the findings' recommended primary source) instead of per-contract IPFS. ✓
- `refresh-metadata` (periodic re-fetch for updated pins / new editions) → Task 6 `refreshStaleCollections` (hourly, `fetchedAt` older than a day). ✓
- `rollups` (holder counts, class distribution, serial/rarity stats, Ruby balances) → Task 5 (`collection_holders`, `class_distribution`, `ruby_balance`, `global_stats`). ✓
- `mirror-media` → **explicitly deferred** (decision: store source URLs; own-CDN mirroring is a later plan). Called out in Global Constraints. ✓
- Node + `tsx`, cron-scheduled → Tasks 3 + 6 (`croner`). The spec's "Valkey-backed queue" is intentionally simplified to cron (matches the reference worker, which is also cron-driven, and is YAGNI for periodic scans) — noted in Architecture. ✓
- Reads indexer read-only, writes app DB → enforced throughout (Global Constraints + every job). ✓
- Class stored as raw `rarityLevel` int; `classLetter` null (mapping still unknown) → Task 4 rows. ✓

**2. Placeholder scan:** No "TBD/TODO/implement later" in code steps. The one lenient area — TopPort response shapes — is handled with `.passthrough()` zod schemas + a live-verify step (Task 4 Step 4) that confirms the real shape, mirroring Plan 2's version-drift notes. The `void sql;` line has an explicit keep-or-remove instruction. The `not in TopPort catalog` path writes a real minimal row (not a stub).

**3. Type consistency:** `ParsedTopportDesign` fields (Task 2) are consumed exactly in `topportRow` (Task 4). `parseTopportBox(box, fallbackEdition)` signature matches its calls in Tasks 4 + 6. `computeRubyBalances`/`computeClassDistribution` signatures (Task 5) match their tests + `recomputeRollups` usage. `pieceDesignMeta` / `rollupStat` columns match the live app schema (`contract_address`, `rarity`, `is_hidden` boolean, `raw_metadata`, `fetched_at`; `rollup_stat` PK `[scope,key]`). `indexerSchema.pieceCollection.{id,edition}`, `pieceToken.{contractAddress,owner}`, `rubyTransfer.{from,to,value}` match the pulled read-model. `db` / `indexer` / `indexerSchema` import paths match `@repo/db` exports.

**Refinements noted vs. spec:**

- Enrichment is **TopPort-catalog-primary, no IPFS/RPC fallback** in this slice (the findings show TopPort is richer and public; per-contract IPFS/`tokenURI` would need an RPC `eth_call` the worker otherwise doesn't make). **Catalog membership defines a real/listed design**: catalog-absent contracts (verified: 4 `2025 Season 1` pre-launch/test deploys) are **skipped**, so `piece_design_meta` == the app-listed set and the website inner-joins design ⇄ on-chain naturally (no `listed` column). An IPFS/RPC fallback for a genuinely-listed-but-catalog-lagging contract can be added later without schema change.
- **Cron, not a Valkey queue** — simpler, matches the reference, and fits periodic-scan jobs; Valkey stays available for later caching/real-time.
- **No media mirroring / no `classLetter`** in this slice (both deferred, both documented).
