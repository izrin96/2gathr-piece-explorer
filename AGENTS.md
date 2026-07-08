# AGENTS.md — 2gathr-nft-tracker

NFT explorer for **2GATHR** (Titan Content Inc.'s K-pop fan app; artist **AtHeart**). Indexes the
**Piece** NFTs (and **Ruby** ERC-20) on the **TITAN Avalanche L1** and serves a public explorer.
pnpm + Turborepo monorepo. This file is for AI agents — keep it structured and verified.

## Start here (read before non-trivial work)

| Doc                                                                  | What                                         |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `docs/superpowers/specs/2026-07-04-2gathr-nft-explorer-design.md`    | Approved architecture + on-chain facts       |
| `docs/superpowers/plans/2026-07-04-2gathr-explorer-01-foundation.md` | Phase 0 plan (done)                          |
| `docs/superpowers/plans/2026-07-05-2gathr-explorer-02-indexer.md`    | Plan 2 — Subsquid indexer (done)             |
| `docs/superpowers/research/2gathr-api-findings.md`                   | 2gathr/TopPort API inspection (feeds worker) |

## Commands

Run from repo root. Turborepo fans out to workspaces.

| Task                | Command                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Install             | `pnpm install`                                                                      |
| Typecheck           | `pnpm typecheck`                                                                    |
| Lint                | `pnpm lint` (oxlint `--type-aware`)                                                 |
| Format              | `pnpm format` (oxfmt) · check: `pnpm exec oxfmt --check .`                          |
| Test                | `pnpm test` (Vitest) · one pkg: `pnpm --filter @repo/lib test`                      |
| Dev stack up        | `docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer` |
| DB push (app)       | `pnpm --filter @repo/db db:push` (needs `.env`; see gotchas)                        |
| DB studio           | `pnpm --filter @repo/db db:studio`                                                  |
| Indexer run         | `pnpm --filter indexer process` (RPC backfill vs Titan; ~1h50m for full history)    |
| Indexer codegen     | `pnpm --filter indexer codegen` (TypeORM models from `schema.graphql`)              |
| Indexer migrate     | `pnpm --filter indexer migration:generate` · `migration:apply` (needs stack up)     |
| Pull indexer schema | `pnpm --filter @repo/db db:pull:indexer` (→ `src/indexer/`; run vs direct 5434)     |

Copy `.env.example` → `.env` before DB commands.

## Non-negotiable conventions

- **pnpm only** (v11). Never npm/yarn/bun. Node runtime (no Bun).
- **Relative imports carry `.js` extensions** (nodenext tsconfig): `import { x } from "./thing.js"`. Package imports (`@repo/…`) stay bare. **Exception: `apps/indexer` is a CommonJS Subsquid app** (no `"type":"module"`) — its `src/` relative imports are **extensionless** (matches Subsquid codegen output); it has **no `@repo/lib` runtime dep** (inlines `ZERO_ADDRESS`). **Exception: `apps/website` uses `moduleResolution: bundler`** (TanStack Start/Vite) — its relative imports are extensionless and it uses a `@/` alias for `src/`; the `.js`-extension rule applies to the nodenext packages only.
- **Dependency versions**: pnpm catalogs (`pnpm-workspace.yaml`) hold only genuinely shared deps
  (typescript, vite, vitest, @types/node, drizzle-orm, zod, pg, turbo, tsx) as `catalog:` /
  `catalog:dev`; app-specific deps are pinned directly in that app's `package.json`.
- **Internal deps** use `workspace:*`. Internal names: `@repo/{tsconfig,lint,lib,db,2gathr}`.
- **Lint = oxlint `--type-aware`; format = oxfmt** (config: `packages/lint/oxlint.config.ts`, root `oxfmt.config.ts`). A clean oxlint run prints nothing and exits 0 — check the exit code, not stdout.
- **Two databases, never crossed**: app `main` (`DATABASE_URL`, Drizzle read/write) and `indexer` (`INDEXER_DATABASE_URL`, owned by Subsquid/TypeORM — read-only from app/worker).
- **No TDD**: don't write tests unless asked. Verify with typecheck/lint and by driving the app.
- Commit only when asked; branch off `main` first. Conventional Commit messages.

## Layout

```
apps/       indexer (Subsquid, built) · worker (built) · website (TanStack Start, built)
packages/   tsconfig · lint · lib · db · 2gathr
```

| Package          | Responsibility              | Key exports                                                                             |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `@repo/tsconfig` | Shared TS configs           | `tsconfig.{base,node,react}.json`                                                       |
| `@repo/lint`     | Shared oxlint config        | `./oxlint.config`                                                                       |
| `@repo/lib`      | Pure utils + domain types   | `normalizeAddress`, `isAddress`, `ZERO_ADDRESS`, `parsePieceName`, `normalizeMember`    |
| `@repo/db`       | Drizzle clients + schema    | `db` (app), `indexer` (read-only), `indexerSchema` (pulled piece/ruby tables), `citext` |
| `@repo/2gathr`   | IPFS/TopPort types + parser | `pieceMetadataSchema`, `parsePieceMetadata`, `createHttpClient`                         |

`apps/*` are created per phase (Plan 2 = indexer ✓, Plan 3 = worker ✓, then website).

## Architecture facts (Titan L1)

- Chain **TITAN** (Avalanche L1), `chainId 84358`, RPC `https://subnets.avax.network/titan/mainnet/rpc`. **No Subsquid archive** → RPC-only; `eth_getLogs` capped at **2048 blocks** — but the installed `@subsquid/evm-processor` hard-splits getLogs into **10-block** strides, so the cap is never hit (full ~25k-block backfill ≈ 1h50m at the current rate limit).
- **Ruby** = one ERC-20 (`0x16ac90358d5f8610a85fa5270659356afdc48a9e`). **Piece** = many ERC-721 contracts, **one per design**; **serial = on-chain `tokenId`** (stored as `numeric`/BigInt, not int4). Heart / Piece-Point are off-chain (app-only). The indexer wildcard-classifies by topic arity (4→ERC-721 Piece, 3+Ruby→Ruby) into `piece_collection` / `piece_token` / `piece_transfer` / `ruby_transfer`.
- **Metadata**: prefer the **public TopPort catalog** `GET api.topport.io/api/service/mysterybox?isCollection=true&chainId=84358` (+ `/mysterybox/{id}` → `boxContractAddress`, item `rarity` → class (S/A/B; box `rarityLevel` is a red herring), edition, member/#, images, supply). IPFS `tokenURI` (Pinata) is the canonical fallback. See the findings doc.
- The 2gathr app API (`api.iand-dev.com`) is bearer-authed/user-scoped; **no public address→nickname** — the explorer shows addresses.

## Gotchas

- **`db:push` via pgbouncer (port 5433) can fail on DDL** (transaction pooling). Push against direct Postgres **5432** instead. The app's runtime pooled URL still uses 5433.
- **`citext`** extension is auto-provisioned on a fresh Postgres volume via `docker/postgres-init/01-citext.sql`; an already-running volume created it manually.
- Indexer DB host port **5434** can collide with a sibling project's Postgres container — check `docker compose ps` if it won't bind.
- **Indexer connects to Postgres directly on 5434** (`DB_URL`), never pgbouncer — Subsquid runs long/DDL transactions that transaction-pooling breaks. Migrations + processor + `db:pull:indexer` target 5434; the app/worker read the indexer DB read-only via pgbouncer **5435** (`INDEXER_DATABASE_URL`).
- **Re-pulling the indexer schema** (`db:pull:indexer`) regenerates a stray plural `relations.ts` + a snapshot dir + `*.sql` (all git-ignored) and may re-add unused imports to `src/indexer/schema.ts` — strip those unused imports after a re-pull; keep the hand-written singular `relation.ts`.

## Status

Phase 0 (foundation) + **Plan 2 (Subsquid indexer)** + **Plan 3 (enrichment worker)** complete and merged. `apps/indexer` wildcard-indexes Ruby + Piece `Transfer`s on Titan into the `indexer` DB; `@repo/db/src/indexer` is the read-only Drizzle model. `apps/worker` (cron-scheduled, `croner`) enriches `piece_design_meta` from the TopPort public catalog (class/edition/member/media, hourly stale-design refresh) and recomputes `rollup_stat` rollups (holder counts, class distribution, Ruby balances); media mirroring and an IPFS/RPC fallback are deferred.

**Website pieces MVP** (spec `docs/superpowers/specs/2026-07-08-website-pieces-mvp-design.md`):
`apps/website` (TanStack Start SSR + stock shadcn Base UI + oRPC/TanStack Query) serves `/`
(latest-first design grid, URL-driven member/class/edition filters + sort) and
`/pieces/$contract` (media, metadata incl. Ruby `price`, serial list). Media rule: `animationUrl`
mp4 → autoplay video, else original `imageUrl`, never `thumbnailUrl`. Designs with no
`piece_design_meta` row (the 4 earliest collections, test contracts) are excluded from the site
entirely — not listed, detail URLs 404. Manual dark mode (blocking init script sets `.dark`
before paint from `localStorage`/`prefers-color-scheme`, toggle in the header; no FOUC). Dates
render in the viewer's local timezone via `LocalTime` (UTC on first paint to match SSR, swaps to
local client-side post-mount — never render local time during SSR, the viewer's zone isn't known
server-side). The serial list on `/pieces/$contract` reveals incrementally on scroll (client-side
windowing, +30/scroll) since it's fetched in one shot (max ~512 rows).

**Holder/address pages**: `/address/$address` is a tabbed layout (Pieces / Activity, shadcn Base
UI `Tabs`) — `address.$address.tsx` (header + tabs + `Outlet`), `.index.tsx` (owned-pieces grid),
`.activity.tsx` (activity feed). The activity feed merges Piece + Ruby transfers
(`lib/holder.ts` `mergeActivity`): a same-hash Ruby payment pairs into its Piece row as
`priceWei` instead of listing separately (was leaking as a confusing standalone "Sent RUBY to
0x…" row), and pairing/consumption must happen _before_ the meta-less-collection `continue` or an
excluded mint's Ruby cost dangles unconsumed. Infinite-scroll via TanStack Query
`useSuspenseInfiniteQuery` against `orpc.holders.activity` (25/page, `IntersectionObserver`
sentinel — `hooks/use-load-more-on-scroll.ts`, shared with the serials reveal above); a type
filter (`?type=piece|ruby`) lives in the URL. `orpc/router.ts` is now just the merge point —
procedures live in `orpc/routers/{shared,pieces,holders}.ts`. Search, auth, i18n deferred.
