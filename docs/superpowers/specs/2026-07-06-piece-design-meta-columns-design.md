# piece_design_meta — additional TopPort columns (design)

**Date:** 2026-07-06
**Status:** Approved (brainstorm)
**Scope:** Promote 7 already-captured TopPort catalog fields from `raw_metadata` (jsonb) into
typed, queryable columns on `piece_design_meta`, wiring them through the parser and enrichment
worker. Additive and backward-compatible.

## Motivation

`piece_design_meta` currently stores member, design number, edition, class, media URLs, and the
full raw box in `raw_metadata`. The TopPort public catalog exposes richer per-design identity that
the explorer will want to filter, sort, and display — notably each item's `properties[]` array
(which mirrors the IPFS `attributes`). Everything below is **already fetched and stored in
`raw_metadata`**; this change only promotes selected fields to real columns so they can be queried
and rendered without digging through jsonb at read time.

## Endpoint analysis (verified 2026-07-06, live catalog, 150 Titan designs)

Source: `GET https://api.topport.io/api/service/mysterybox?isCollection=true&chainId=84358&limit=300`
(the list already embeds `mysteryboxItems`, `boxContractAddress`, and all box fields).

Every design's item carries these `properties` (150/150):

| Property | Distinct values                                    | Decision                         |
| -------- | -------------------------------------------------- | -------------------------------- |
| Artist   | `AtHeart` (uniform)                                | **promote** (future-proof)       |
| Series   | `AtHeart` (142), `Puppy AtHeart` (7), `2GATHR` (1) | **promote** (== box `symbol`)    |
| Type     | `Image` (130), `Video` (12), `3D` (8)              | **promote** (coexist media_type) |
| Serial   | 0–22                                               | **promote** (coexist design_num) |
| Member   | 7 members                                          | already stored                   |
| Hidden   | True/False                                         | already stored (`is_hidden`)     |
| Display  | True/False, only 64 items, ambiguous               | leave in `raw_metadata`          |

Box-level fields:

| Field              | Spread                    | Decision                                   |
| ------------------ | ------------------------- | ------------------------------------------ |
| `id`               | unique                    | **promote** (`topport_id`) — join/deeplink |
| `price` + `quote`  | 0/1/2/20 ruby; quote ruby | **promote** `price`; quote uniform → skip  |
| `releaseDatetime`  | 2025-10-20 → 2026-07-04   | **promote** (`release_datetime`)           |
| item `description` | free text                 | skip (stays in `raw_metadata`)             |

Confirmed junk / skipped (uniform or on-chain is source of truth for supply):
`totalAmount` (10000), `usedAmount` (0), `soldAmount` (0), `itemAmount` (1),
`status`/`deployStatus`/`isSoldOut`/`dropsOpen` (all uniform), item `tokenId` (`"NaN"`),
`issueAmount` (10000), `levels`/`stats` (empty everywhere).

## New columns (`packages/db/src/schema.ts` → `pieceDesignMeta`)

All nullable. Sourced from the TopPort box the worker already fetches.

| Column             | Type                        | Source                                   |
| ------------------ | --------------------------- | ---------------------------------------- |
| `artist`           | `text`                      | `properties[Artist]`                     |
| `series`           | `text`                      | `properties[Series]` → fallback `symbol` |
| `type`             | `text`                      | `properties[Type]` (Image/Video/3D)      |
| `serial`           | `integer`                   | `properties[Serial]` (parseInt-guarded)  |
| `topport_id`       | `integer`                   | box `id`                                 |
| `release_datetime` | `timestamptz` (mode string) | box `releaseDatetime`                    |
| `price`            | `integer`                   | box `price`                              |

**Coexistence (decided):**

- `type` (semantic kind) and `media_type` (file extension mp4/png/jpeg) both kept — different
  questions, no change to existing `media_type` derivation.
- `serial` (metadata-canonical) and `design_number` (name-parsed) both kept — they agree except
  the 6 Hidden pieces (Serial=0 vs name `#001`), and that divergence is itself meaningful.

**Indexes:** add btree indexes on `series` and `type` (natural explorer facets, mirroring the
existing `piece_design_meta_member_idx`). Leave `release_datetime` unindexed for now.

## Type schema (`packages/2gathr/src/types/topport.ts`)

Promote `price`, `releaseDatetime`, and `symbol` from passthrough into the typed
`topportBoxSchema`, each `.optional()`. `id` is already typed; item `properties` already parsed
via `topportPropertySchema`. Additive optional fields — no breaking change; `.passthrough()` stays.

## Parser (`packages/2gathr/src/topport.ts`)

Extend `ParsedTopportDesign` and `parseTopportBox`:

- Read `Artist`, `Series`, `Type`, `Serial` from `item.properties` using the existing
  `props.find((p) => p.type === …)?.name` pattern.
- `series` = `Series` property, else `box.symbol`, else `null`.
- `serial` = `parseInt(Serial, 10)`, guarded to `null` on `NaN`/absent.
- `artist`, `type` = the property `name` or `null`.
- `topportId` = `box.id` (number) or `null`.
- `releaseDatetime` = `box.releaseDatetime` (string) or `null`.
- `price` = `box.price` (number) or `null`.

All new fields default to `null` when absent; no throws.

## Worker (`apps/worker/src/jobs/enrich-collections.ts`)

Map the seven new parsed fields onto the row in `topportRow()`. Both `enrichCollections`
(first-enrich) and `refreshStaleCollections` (hourly stale refresh) route through `topportRow`, so
this single change covers both paths — existing rows backfill the new columns on their next stale
refresh automatically. Unlisted/test contracts (absent from the catalog) are still skipped as today.

## Migration

Additive nullable columns → safe. Apply via `pnpm --filter @repo/db db:push` against **direct
Postgres 5432** (per the pgbouncer-DDL gotcha), not the pooled 5433 URL.

## Testing (TDD — tests first)

- `packages/2gathr/src/topport.test.ts`:
  - assert `artist`, `series`, `type`, `serial`, `topportId`, `releaseDatetime`, `price` parse
    from a representative box;
  - `series` falls back to `box.symbol` when the `Series` property is absent;
  - `serial` int-parses, and the Hidden-piece case yields `serial=0` while `design_number` (from
    name `#001`) stays `1`;
  - non-standard item with no properties → new fields `null` (no throw).
- `packages/db/src/schema.test.ts`: extend if it asserts the column set.

## Data flow (unchanged)

cron → `buildContractCatalog` → `parseTopportBox` → `topportRow` → upsert into `piece_design_meta`.

## Out of scope (noted only)

The list endpoint already embeds `mysteryboxItems` + `boxContractAddress` + all box fields, so the
150 per-id detail fetches in `buildContractCatalog` are redundant — a separate optimization, not
part of this change.
