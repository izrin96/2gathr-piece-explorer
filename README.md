# 2gathr Piece Explorer

A public NFT explorer for **2GATHR** (Titan Content Inc.'s K-pop fan app; artist **AtHeart**).
Indexes the **Piece** NFTs (ERC-721) and **Ruby** token (ERC-20) on the **TITAN Avalanche L1**
and serves a browsable explorer of designs, media, and serials.

## Stack

pnpm + Turborepo monorepo, TypeScript throughout.

```
apps/
  indexer   Subsquid processor — indexes Ruby + Piece Transfer events from Titan into Postgres
  worker    Cron-scheduled enrichment — pulls TopPort metadata, recomputes holder/rarity rollups
  website   TanStack Start SSR site — the public explorer (design grid, per-collection detail,
            holder/address pages with an infinite-scroll activity feed, dark mode)

packages/
  lib        Pure utils + domain types (address normalization, Piece name parsing, etc.)
  db         Drizzle clients/schema for the app DB + read-only access to the indexer DB
  2gathr     IPFS/TopPort metadata types + parser
  tsconfig   Shared TypeScript configs
  lint       Shared oxlint config
```

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer
pnpm --filter @repo/db db:push
pnpm dev
```

The app DB (`packages/db`) uses a hybrid workflow: **dev** syncs a local Postgres straight from
`packages/db/src/schema.ts` via `db:push` (no migration files, fast iteration) — `db:push` above
is the only step needed locally, re-run it after pulling schema changes. **Prod** applies a
generated migration instead: run `pnpm --filter @repo/db db:generate` before deploying a schema
change to produce the committed SQL in `packages/db/migrations/`, which the `worker` container
applies automatically on startup (see `apps/worker/Dockerfile`) before its cron jobs start.

## Common commands

| Task             | Command                                                   |
| ---------------- | --------------------------------------------------------- |
| Typecheck        | `pnpm typecheck`                                          |
| Lint             | `pnpm lint`                                               |
| Format           | `pnpm format`                                             |
| Test             | `pnpm test`                                               |
| Website dev      | `pnpm --filter website dev` (or `pnpm dev` for all apps)  |
| DB push (app)    | `pnpm --filter @repo/db db:push`                          |
| DB studio        | `pnpm --filter @repo/db db:studio`                        |
| Indexer backfill | `pnpm --filter indexer process` (~1h50m for full history) |

See [`AGENTS.md`](./AGENTS.md) for the full command reference, conventions, architecture facts,
and known gotchas — it's the source of truth for working in this repo.

## Docs

Design and planning history lives under `docs/superpowers/`:

- **specs/** — approved designs: [NFT explorer architecture](docs/superpowers/specs/2026-07-04-2gathr-nft-explorer-design.md), [piece design-meta columns](docs/superpowers/specs/2026-07-06-piece-design-meta-columns-design.md), [website pieces MVP](docs/superpowers/specs/2026-07-08-website-pieces-mvp-design.md)
- **plans/** — phased implementation plans for the [foundation](docs/superpowers/plans/2026-07-04-2gathr-explorer-01-foundation.md), [indexer](docs/superpowers/plans/2026-07-05-2gathr-explorer-02-indexer.md), [worker](docs/superpowers/plans/2026-07-05-2gathr-explorer-03-worker.md), [design-meta columns](docs/superpowers/plans/2026-07-06-piece-design-meta-columns.md), and [website MVP](docs/superpowers/plans/2026-07-08-website-pieces-mvp.md)
- **research/** — [2gathr/TopPort API findings](docs/superpowers/research/2gathr-api-findings.md) that feed the enrichment worker

## Status

Foundation, indexer, and enrichment worker are complete and merged. The website serves the
latest-first design grid with member/class/edition filters, per-collection detail pages, and
holder/address pages (owned pieces + a filterable, infinite-scroll activity feed) with dark
mode. Search, auth, and i18n are deferred.
