# piece_design_meta — Additional TopPort Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote 7 already-captured TopPort catalog fields (artist, series, type, serial, topport_id, release_datetime, price) from `raw_metadata` into typed, queryable columns on `piece_design_meta`, wired through the type schema, parser, and enrichment worker.

**Architecture:** Three layers, in dependency order: (1) extend the Zod `topportBoxSchema` to type three box fields; (2) extend `parseTopportBox`/`ParsedTopportDesign` to extract the seven values from the box + item `properties`; (3) add the columns to the Drizzle `pieceDesignMeta` table and map them in the worker's `topportRow`. Everything is additive and nullable — no existing behavior changes.

**Tech Stack:** TypeScript (nodenext ESM in `packages/*`), Zod, Drizzle ORM (Postgres), Vitest, pnpm + Turborepo.

## Global Constraints

- pnpm only (v11). Never npm/yarn/bun. Node runtime.
- Relative imports in `packages/*` carry `.js` extensions (nodenext). Package imports (`@repo/…`) stay bare. (`apps/worker` is also ESM with `.js` extensions.)
- Dependency versions live in pnpm catalogs — never pin in a package's `package.json`. (No new deps in this plan.)
- Lint = oxlint `--type-aware` (clean run prints nothing, exit 0); format = oxfmt.
- TDD: failing test → minimal impl → passing test.
- Two databases, never crossed: app `main` (`DATABASE_URL`, Drizzle) vs `indexer` (read-only). This plan touches only the app `main` DB.
- `db:push` DDL must target **direct Postgres 5432**, not pgbouncer 5433.
- Commit messages: Conventional Commits.
- All 7 new columns are **nullable**; parser returns `null` on absence, never throws.
- Field sources (verbatim): `artist`=`properties[Artist]`; `series`=`properties[Series]` else box `symbol`; `type`=`properties[Type]`; `serial`=`parseInt(properties[Serial])`; `topportId`=box `id`; `releaseDatetime`=box `releaseDatetime`; `price`=box `price`.

---

### Task 1: Type the three box fields in `topportBoxSchema`

**Files:**

- Modify: `packages/2gathr/src/types/topport.ts:36-47`
- Test: `packages/2gathr/src/topport.test.ts`

**Interfaces:**

- Consumes: nothing (leaf).
- Produces: `TopportBox` gains typed optional `symbol?: string`, `price?: number`, `releaseDatetime?: string`. (`id: number` is already typed.)

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("topportBoxSchema", …)` block in `packages/2gathr/src/topport.test.ts` (after the existing `it(...)`):

```typescript
it("types symbol, price, and releaseDatetime", () => {
  const box = topportBoxSchema.parse({
    ...BOX_258,
    symbol: "AtHeart",
    price: 20,
    releaseDatetime: "2026-06-30T14:00:00.000Z",
  });
  expect(box.symbol).toBe("AtHeart");
  expect(box.price).toBe(20);
  expect(box.releaseDatetime).toBe("2026-06-30T14:00:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/2gathr test -- topport`
Expected: FAIL — `box.symbol` / `box.price` / `box.releaseDatetime` are typed `unknown`/absent (TS error or runtime `undefined`).

- [ ] **Step 3: Add the three optional fields to the schema**

In `packages/2gathr/src/types/topport.ts`, add three lines inside the `topportBoxSchema` object (after `usedAmount: z.number().optional(),`):

```typescript
    symbol: z.string().optional(),
    price: z.number().optional(),
    releaseDatetime: z.string().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/2gathr test -- topport`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/2gathr/src/types/topport.ts packages/2gathr/src/topport.test.ts
git commit -m "feat(2gathr): type symbol/price/releaseDatetime on topportBoxSchema"
```

---

### Task 2: Extract the 7 fields in `parseTopportBox`

**Files:**

- Modify: `packages/2gathr/src/topport.ts:8-63`
- Test: `packages/2gathr/src/topport.test.ts`

**Interfaces:**

- Consumes: `TopportBox` from Task 1 (`symbol`, `price`, `releaseDatetime`, `id`); existing `item.properties` array of `{ type, name }`.
- Produces: `ParsedTopportDesign` gains `artist: string | null`, `series: string | null`, `type: string | null`, `serial: number | null`, `topportId: number | null`, `releaseDatetime: string | null`, `price: number | null`.

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `describe("parseTopportBox", …)` block in `packages/2gathr/src/topport.test.ts` (append after the last `it(...)`):

```typescript
it("extracts artist, series, type, serial, topportId, releaseDatetime, and price", () => {
  const box = topportBoxSchema.parse({
    ...BOX_258,
    symbol: "AtHeart",
    price: 20,
    releaseDatetime: "2026-06-30T14:00:00.000Z",
    mysteryboxItems: [
      {
        ...BOX_258.mysteryboxItems[0],
        properties: [
          { type: "Artist", name: "AtHeart" },
          { type: "Series", name: "AtHeart" },
          { type: "Type", name: "Image" },
          { type: "Serial", name: "22" },
          { type: "Member", name: "Bome" },
        ],
      },
    ],
  });
  const d = parseTopportBox(box, "2026 Season 3");
  expect(d.artist).toBe("AtHeart");
  expect(d.series).toBe("AtHeart");
  expect(d.type).toBe("Image");
  expect(d.serial).toBe(22);
  expect(d.topportId).toBe(258);
  expect(d.releaseDatetime).toBe("2026-06-30T14:00:00.000Z");
  expect(d.price).toBe(20);
});

it("falls back to box.symbol for series when the Series property is absent", () => {
  const box = topportBoxSchema.parse({
    ...BOX_258,
    symbol: "Puppy AtHeart",
    mysteryboxItems: [
      {
        ...BOX_258.mysteryboxItems[0],
        properties: [{ type: "Artist", name: "AtHeart" }],
      },
    ],
  });
  const d = parseTopportBox(box, "Welcome");
  expect(d.series).toBe("Puppy AtHeart");
});

it("reads serial=0 from a Hidden piece while design_number stays name-derived", () => {
  const box = topportBoxSchema.parse({
    ...BOX_258,
    mysteryboxItems: [
      {
        name: "BOME (Hidden) #001",
        properties: [
          { type: "Member", name: "Bome" },
          { type: "Serial", name: "0" },
          { type: "Hidden", name: "True" },
        ],
      },
    ],
  });
  const d = parseTopportBox(box, "Hidden Piece");
  expect(d.serial).toBe(0);
  expect(d.designNumber).toBe(1); // parsed from the name "#001"
});

it("leaves the new fields null when the box/item lack them", () => {
  const box = topportBoxSchema.parse({
    id: 999,
    title: { en: "Welcome" },
    mysteryboxItems: [{ name: "Welcome to 2GATHR", imageLink: "https://x/y.png" }],
  });
  const d = parseTopportBox(box, "Welcome");
  expect(d.artist).toBeNull();
  expect(d.series).toBeNull();
  expect(d.type).toBeNull();
  expect(d.serial).toBeNull();
  expect(d.price).toBeNull();
  expect(d.releaseDatetime).toBeNull();
  expect(d.topportId).toBe(999); // id is required by the schema
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/2gathr test -- topport`
Expected: FAIL — `d.artist`, `d.series`, `d.type`, `d.serial`, `d.topportId`, `d.releaseDatetime`, `d.price` do not exist on `ParsedTopportDesign`.

- [ ] **Step 3: Extend the `ParsedTopportDesign` interface**

In `packages/2gathr/src/topport.ts`, add these fields to the `ParsedTopportDesign` interface (after `isHidden: boolean;`):

```typescript
artist: string | null;
series: string | null;
type: string | null;
serial: number | null;
topportId: number | null;
releaseDatetime: string | null;
price: number | null;
```

- [ ] **Step 4: Extract the values in `parseTopportBox`**

In `packages/2gathr/src/topport.ts`, inside `parseTopportBox`, after the existing `const hiddenProp = …` line, add:

```typescript
const artistProp = props.find((p) => p.type === "Artist")?.name;
const seriesProp = props.find((p) => p.type === "Series")?.name;
const typeProp = props.find((p) => p.type === "Type")?.name;
const serialProp = props.find((p) => p.type === "Serial")?.name;
const serial = serialProp !== undefined ? Number.parseInt(serialProp, 10) : Number.NaN;
```

Then add these keys to the object returned by `parseTopportBox` (after `isHidden: …,`):

```typescript
    artist: artistProp ?? null,
    series: seriesProp ?? box.symbol ?? null,
    type: typeProp ?? null,
    serial: Number.isNaN(serial) ? null : serial,
    topportId: box.id ?? null,
    releaseDatetime: box.releaseDatetime ?? null,
    price: box.price ?? null,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @repo/2gathr test -- topport`
Expected: PASS (all parseTopportBox tests, including the existing ones).

- [ ] **Step 6: Lint the package**

Run: `pnpm --filter @repo/2gathr lint`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add packages/2gathr/src/topport.ts packages/2gathr/src/topport.test.ts
git commit -m "feat(2gathr): parse artist/series/type/serial/topportId/releaseDatetime/price"
```

---

### Task 3: Add the 7 columns to the `pieceDesignMeta` table

**Files:**

- Modify: `packages/db/src/schema.ts:15-33`
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**

- Consumes: nothing (Drizzle table definition).
- Produces: `pieceDesignMeta` gains columns `artist` (text), `series` (text), `type` (text), `serial` (integer), `topport_id` (integer), `release_datetime` (timestamptz, mode string), `price` (integer); plus indexes `piece_design_meta_series_idx` and `piece_design_meta_type_idx`.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("app schema", …)` block in `packages/db/src/schema.test.ts`:

```typescript
it("has the added TopPort columns on piece_design_meta", () => {
  const cfg = getTableConfig(pieceDesignMeta);
  const names = new Set(cfg.columns.map((c) => c.name));
  for (const col of [
    "artist",
    "series",
    "type",
    "serial",
    "topport_id",
    "release_datetime",
    "price",
  ]) {
    expect(names.has(col)).toBe(true);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/db test -- schema`
Expected: FAIL — the new column names are absent from `cfg.columns`.

- [ ] **Step 3: Add the columns and indexes**

In `packages/db/src/schema.ts`, add the seven columns to the `pieceDesignMeta` column object (after `isHidden: boolean("is_hidden"),` and before `rawMetadata: …`):

```typescript
    artist: text("artist"),
    series: text("series"),
    type: text("type"),
    serial: integer("serial"),
    topportId: integer("topport_id"),
    releaseDatetime: timestamp("release_datetime", { mode: "string", withTimezone: true }),
    price: integer("price"),
```

Then replace the index array (the `(t) => [ … ]` argument) with:

```typescript
  (t) => [
    index("piece_design_meta_member_idx").on(t.member),
    index("piece_design_meta_series_idx").on(t.series),
    index("piece_design_meta_type_idx").on(t.type),
  ],
```

(`integer`, `text`, `timestamp`, and `index` are already imported at the top of the file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/db test -- schema`
Expected: PASS.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @repo/db typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "feat(db): add artist/series/type/serial/topport_id/release_datetime/price to piece_design_meta"
```

---

### Task 4: Map the new fields in the worker's `topportRow`

**Files:**

- Modify: `apps/worker/src/jobs/enrich-collections.ts:69-91`

**Interfaces:**

- Consumes: `ParsedTopportDesign` fields from Task 2 (`d.artist`, `d.series`, `d.type`, `d.serial`, `d.topportId`, `d.releaseDatetime`, `d.price`); `pieceDesignMeta` columns from Task 3.
- Produces: `topportRow` writes the seven new columns; used by both `enrichCollections` and `refreshStaleCollections`.

- [ ] **Step 1: Add the seven fields to the returned row**

In `apps/worker/src/jobs/enrich-collections.ts`, inside `topportRow`, add these keys to the returned object (after `isHidden: d.isHidden,` and before `rawMetadata: box,`):

```typescript
    artist: d.artist,
    series: d.series,
    type: d.type,
    serial: d.serial,
    topportId: d.topportId,
    releaseDatetime: d.releaseDatetime,
    price: d.price,
```

- [ ] **Step 2: Typecheck the worker**

Run: `pnpm --filter worker typecheck`
Expected: exit 0 — the row object matches the extended `pieceDesignMeta` insert type.

- [ ] **Step 3: Lint the worker**

Run: `pnpm --filter worker lint`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/jobs/enrich-collections.ts
git commit -m "feat(worker): write the 7 new TopPort columns in topportRow"
```

---

### Task 5: Migrate the app DB and backfill

**Files:**

- None (DDL push + data refresh; no source changes).

**Interfaces:**

- Consumes: the schema from Task 3.
- Produces: the seven columns + two indexes existing in the app `main` Postgres; existing rows populated on the next worker run.

- [ ] **Step 1: Ensure the dev stack is up**

Run: `docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer`
Expected: containers running (`docker compose ps` shows postgres healthy).

- [ ] **Step 2: Push the schema against direct Postgres 5432**

Run: `pnpm --filter @repo/db db:push`
Expected: Drizzle reports adding 7 columns + 2 indexes to `piece_design_meta`, no data loss. (If `db:push` uses the pooled 5433 URL and errors on DDL, re-run with `DATABASE_URL` pointed at direct 5432 per the CLAUDE.md gotcha.)

- [ ] **Step 3: Verify columns exist**

Run: `pnpm --filter @repo/db db:studio` (or `psql`), and confirm `piece_design_meta` shows `artist, series, type, serial, topport_id, release_datetime, price`.
Expected: all seven present, nullable.

- [ ] **Step 4: Backfill existing rows**

The worker's `refreshStaleCollections` re-writes rows through `topportRow`, but only stale ones. To backfill immediately, run the worker's enrichment once (the enrich job upserts via `onConflictDoUpdate`, so re-running rewrites the new columns for cataloged contracts):

Run: `pnpm --filter worker start` (or the worker's one-shot enrichment entrypoint), let one enrichment cycle complete, then stop it.
Expected: rows now have `artist`/`series`/`type`/`serial`/`topport_id`/`release_datetime`/`price` populated for cataloged designs.

- [ ] **Step 5: Spot-check the data**

Query a known design, e.g. `SELECT contract_address, member, series, type, serial, topport_id, price, release_datetime FROM piece_design_meta LIMIT 5;`
Expected: `series` in {AtHeart, Puppy AtHeart, 2GATHR}, `type` in {Image, Video, 3D}, `serial` an int, `topport_id` set, `price` in {0,1,2,20}.

- [ ] **Step 6: No commit** (this task is DB state, not source). If `db:push` generated a migration/snapshot artifact that is tracked, commit only that:

```bash
git status --short   # only commit generated migration files if the repo tracks them
```

---

### Task 6: Full verification

**Files:**

- None (repo-wide checks).

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all packages pass, including the new `@repo/2gathr` and `@repo/db` tests.

- [ ] **Step 2: Typecheck the monorepo**

Run: `pnpm typecheck`
Expected: exit 0 across all workspaces.

- [ ] **Step 3: Lint the monorepo**

Run: `pnpm lint`
Expected: exit 0, no output.

- [ ] **Step 4: Format check**

Run: `pnpm exec oxfmt --check .`
Expected: no files need formatting.

---

## Self-Review

**Spec coverage:**

- All 7 columns (artist, series, type, serial, topport_id, release_datetime, price) → Tasks 2 (parse), 3 (schema), 4 (worker), 5 (migrate). ✓
- Type schema promotion of symbol/price/releaseDatetime → Task 1. ✓
- series→symbol fallback → Task 2 Step 1 test + Step 4 impl. ✓
- serial parseInt + Hidden-piece divergence → Task 2 tests. ✓
- coexistence of type/media_type and serial/design_number → additive columns, existing derivations untouched (Tasks 2–3 add, never modify `mediaType`/`designNumber`). ✓
- indexes on series + type → Task 3 Step 3. ✓
- migration via direct 5432 → Task 5 Step 2. ✓
- both enrich + refresh covered → Task 4 (single `topportRow`). ✓
- Out-of-scope detail-fetch optimization → intentionally not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command shows expected output.

**Type consistency:** `ParsedTopportDesign` field names (`artist, series, type, serial, topportId, releaseDatetime, price`) defined in Task 2 are consumed verbatim in Task 4. Drizzle column keys (`topportId`→`topport_id`, `releaseDatetime`→`release_datetime`) match between Task 3 (definition) and Task 4 (insert via camelCase keys). Box schema fields (`symbol, price, releaseDatetime`) defined in Task 1 consumed in Task 2. ✓
