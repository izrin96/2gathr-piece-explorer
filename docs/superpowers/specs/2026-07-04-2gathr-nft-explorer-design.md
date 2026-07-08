# 2GATHR NFT Explorer — Design

**Date:** 2026-07-04
**Status:** Approved design; ready for implementation planning (writing-plans).

## 1. Overview

A public web explorer for the on-chain NFTs of the **2GATHR** fan-engagement app
(by Titan Content Inc.), built around its debut K-pop group **AtHeart**. The app's
collectible NFT is called a **Piece**; the explorer lets anyone browse all Pieces,
inspect any wallet's collection, and view holders, rarity, and transfer activity —
with optional accounts for saving addresses and lists.

### Core purpose

Full explorer — **both** global browsing and per-wallet collection tracking.

## 2. On-chain facts (verified against Titan L1)

Confirmed by direct RPC probing of the Titan L1 during design:

- **Chain:** TITAN, a custom Avalanche L1 built with AvaCloud.
  - `chainId` **84358** (`0x14986`), native token **TIN**.
  - RPC: `https://subnets.avax.network/titan/mainnet/rpc`.
  - **No Subsquid archive/gateway** exists for this L1 → indexer runs in **RPC-only mode**.
  - Public RPC caps `eth_getLogs` at **2048 blocks per request**.
  - Chain is tiny/low-volume (~25k blocks at design time; ~155 token contracts) — likely
    produces blocks on demand. Full-history scans are cheap.
- **Assets that live on-chain:**
  - **Ruby** — a single **ERC-20** (`0x16ac90358d5f8610a85fa5270659356afdc48a9e`,
    `name=Ruby`, `symbol=RUBY`, ~20k transfers). Read `decimals` dynamically.
  - **Piece** — **~154 ERC-721 contracts, one per design.** Contract `name()` is the
    **edition** label; token metadata `name` is `MEMBER #designNumber`. Editions seen:
    `2025 Season 1`, `2026 Season 1`, `2026 Season 2`, `2026 Season 3`, `2026 HBD`
    (birthday specials), `Welcome` / `Puppy AtHeart` (onboarding), `Hidden Piece`
    (Piece-Book completion rewards). New contracts are deployed as new designs drop.
  - **Heart** and **Piece Point** — **NOT on-chain** (off-chain in-app balances:
    fiat IAP, hard caps, validity windows, internal Heart→Ruby swap). Out of scope for indexing.
- **Metadata:** each Piece's `tokenURI` returns an **IPFS JSON** (via Pinata gateway).
  - **`tokenURI` is identical for every tokenId in a contract** → metadata is **per design**,
    fetched **once per collection**, not per token.
  - Shape: `{ name:"NAHYUN #001", image:"<ipfs>", extension:"png", alt_url:"<S3 thumbnail>",
animation_url:"<mp4 for 3D>", rarity:<int>, attributes:[Artist, Member, Serial, Type,
Hidden, Display, ...] }`.
  - The JSON `Serial` attribute is a constant `"1"` and is **meaningless** — the real
    serial (the app's "S/N") is the **on-chain `tokenId`**.
  - `rarity` (int) is the **class** (rendered in-app as a letter A/B…); store the raw int
    plus a derived letter once the mapping is confirmed.
  - Thumbnails are hosted on `topport.s3.ap-northeast-2.amazonaws.com` ("TopPort" backend).
- **Members:** 7 — NAHYUN, SEOHYEON, ARIN, BOME, AURORA, Michi, Katelyn.

### Requires HTTP inspection (not available on-chain / IPFS)

- **Address → nickname** mapping (app shows owner as e.g. "Shah189").
- **Piece Book** definitions (which designs complete which book; the Hidden-Piece reward mapping).
- Exact **class** (`rarity` int → letter) mapping.

These come from the 2gathr/TopPort private API and will be confirmed via mitmproxy inspection
(driven with `agent-browser` against the user's Chrome at `127.0.0.1:8081`) as a Phase 0 task.
They are **not** required for the MVP.

## 3. Key decisions

| Decision         | Choice                                                                 | Why                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo tooling | **pnpm 11 workspaces + catalogs + Turborepo**                          | pnpm catalogs replace Bun catalogs cleanly; Turbo is proven for this size and matches the reference. viteplus.dev too early.                             |
| Lint / format    | **oxlint (`--type-aware`) + oxfmt**                                    | User preference; shared `packages/lint` + root `oxfmt.config.ts`.                                                                                        |
| Indexer          | **Subsquid EVM processor, RPC-only, wildcard `Transfer` indexing**     | Batching, reorg handling, checkpointing for free. Wildcard because Piece = many contracts. viem-poller is the documented fallback if the RPC misbehaves. |
| ORM              | **TypeORM in indexer (Subsquid requirement); Drizzle everywhere else** | Matches the reference; Drizzle reads the pulled indexer tables read-only.                                                                                |
| Runtime          | **Node** (website via TanStack Start Node server; worker via `tsx`)    | pnpm/Node instead of the reference's Bun runtime. TypeScript 7 rc.                                                                                       |
| UI               | **shadcn CLI targeting Base UI primitives + Tailwind**                 | Ownable, accessible components.                                                                                                                          |
| Accounts         | **Public + optional accounts** (better-auth, Google)                   | Anyone browses without login; sign in to save addresses/lists. Google sign-in is our own OAuth client and does **not** bridge to 2gathr identity.        |
| Wallet linking   | **Address entry only, no wallet-connect**                              | 2gathr wallets are app-managed/custodial; users can't sign. "Claim address" is a soft, unverified save.                                                  |
| Metadata source  | **On-chain ownership + IPFS metadata (`tokenURI`)**, worker-enriched   | Rich data is on IPFS, not a private API; keeps the indexer pure.                                                                                         |
| i18n             | **Paraglide, en + ko from the start**                                  | Global K-pop fandom.                                                                                                                                     |
| Media            | **Mirror IPFS/S3 assets into our own S3 + CDN**                        | Avoid hotlinking Pinata / TopPort S3; cache thumbnails and 3D animations.                                                                                |

## 4. Monorepo layout

```
2gathr-nft-tracker/
├── apps/
│   ├── indexer/     # Subsquid EVM processor (RPC-mode, wildcard) → Titan L1 (chainId 84358)
│   ├── website/     # TanStack Start + Base UI/shadcn + oRPC + better-auth + Paraglide + Drizzle
│   └── worker/      # Background jobs (metadata/media/rollups), Valkey-backed
├── packages/
│   ├── db/          # Drizzle: app schema + auth-schema + pulled indexer schema
│   ├── 2gathr/      # Typed 2gathr/TopPort API client (ofetch + zod)
│   ├── lib/         # Shared server utils + types
│   ├── lint/        # oxlint config
│   └── tsconfig/    # shared tsconfig (TS 7 rc)
├── pnpm-workspace.yaml
├── turbo.json
├── oxfmt.config.ts
├── docker-compose.yml
└── .env
```

Internal package names: `@repo/db`, `@repo/lib`, `@repo/2gathr`, `@repo/lint`, `@repo/tsconfig`.

## 5. Data model

**Two Postgres 18 databases** (mirrors the reference), each behind its own pgbouncer:

1. **Indexer database** (`indexer`) — owned end-to-end by the Subsquid processor (TypeORM manages
   its migrations/tables). Pulled into Drizzle as read-only types (`packages/db/src/indexer/`, via
   `drizzle-kit pull`). Never written by web/worker.
2. **App database** (`main`) — written by the website via Drizzle. better-auth owns the auth tables.

### Indexer-owned (on-chain truth)

- **`piece_collection`** — one row per ERC-721 Piece contract:
  `contractAddress` (pk), `edition` (contract `name()`), `symbol`, `firstSeenBlock`, `totalSupply`.
- **`piece_token`** — one row per minted token (serial copy):
  `contractAddress`, `tokenId`, `serial` (= tokenId), `owner`, `mintedAt`, `lastTransferAt`, block fields.
- **`piece_transfer`** — every Piece Transfer event: `contractAddress`, `tokenId`, `from`, `to`,
  `timestamp`, `txHash`, `blockNumber` (mint: from `0x0`; burn: to `0x0`).
- **`ruby_transfer`** — every Ruby (ERC-20) Transfer: `from`, `to`, `value`, `timestamp`, `txHash`, `blockNumber`.
- **`ruby_balance`** _(derived rollup, optional at indexer level)_ — `address`, `balance`.

### App-owned (our features + enrichment)

- **better-auth tables** — `user`, `session`, `account`, `verification`.
- **`piece_design_meta`** — worker-filled from IPFS, keyed by `contractAddress`:
  `member`, `designNumber`, `edition`, `rarity`, `classLetter`, `imageUrl` (our mirror),
  `thumbnailUrl` (our mirror), `animationUrl`, `mediaType`, `isHidden`, `isDisplay`, `rawMetadata` (jsonb),
  `fetchedAt`.
- **`address_profile`** — cached `address` → 2gathr `nickname`/avatar/banner, `hiddenFromLeaderboard`,
  `pinned`. (Phase 3 for nickname; row can exist earlier for prefs.)
- **`saved_address`** — a user's soft-claimed/pinned addresses + optional label (unverified).
- **`list` / `list_entry`** — user-curated Piece lists.
- **`piece_book` / `piece_book_requirement`** — Piece Book definitions (source: 2gathr API; Phase 3).
- **Rollup tables** — holder counts, class distribution, serial/rarity stats, edition stats — for fast reads.

**Principle:** the indexer stays deterministic and replayable from chain data alone. Everything that
depends on the mutable IPFS/2gathr layer is owned by the worker/app so a reindex never blocks on an
external service.

## 6. Indexer (`apps/indexer`)

- Subsquid EVM processor, RPC-only datasource (`chain: { url: RPC_URL, rateLimit }`, no `gateway`),
  batch range tuned to the **2048-block** `eth_getLogs` cap; `finalityConfirmation` tuned for Titan.
- **Wildcard `Transfer` subscription** across all addresses (topic `0xddf252ad…`).
- **Contract classification on first sight**, cached (Valkey + `piece_collection`):
  - ERC-20 (`decimals` present) → **Ruby** → `ruby_transfer`.
  - ERC-721 (ERC-165 `0x80ac58cd` / 4-topic Transfer) → **Piece collection** → auto-register in
    `piece_collection`, index tokens + transfers.
  - Otherwise ignore.
- **Auto-registration** of unseen ERC-721 contracts → no redeploy when a new Piece design drops.
- **No metadata fetching in the indexer** (kept pure). Serial = tokenId.
- Config (`src/env.ts`): `RPC_URL`, `RPC_RATE_LIMIT`, `START_BLOCK`, `FINALITY_CONFIRMATION`.
- ABIs typegen'd with `@subsquid/evm-typegen`; `@subsquid/typeorm-migration` creates tables;
  `db:pull:indexer` regenerates the Drizzle read model.
- **Fallback (documented):** if the public RPC rate-limits or truncates `eth_getLogs` ranges
  unacceptably, swap ingestion for a viem `eth_getLogs` poller; the schema is unaffected.

## 7. Worker (`apps/worker`)

Node + `tsx`, Valkey-backed queue. Jobs:

- **`register-collection`** — on a new `piece_collection`: read `name()` + one `tokenURI`, parse
  member/designNumber/class/edition/hidden flags, mirror media to our S3, upsert `piece_design_meta`.
  (One IPFS fetch per collection — metadata is per design.)
- **`refresh-metadata`** — periodic re-fetch for updated pins / newly minted editions.
- **`mirror-media`** — pull image (IPFS), thumbnail (`alt_url` S3), `animation_url` (mp4) into our
  S3 + generate CDN-ready thumbnails.
- **`rollups`** — recompute holder counts, class distribution, serial/rarity stats, Ruby balances.
- Maintenance scripts (backfill, gap detection) as in the reference.

## 8. Website (`apps/website`)

- TanStack Start + React, **Node** server output; **oRPC** + TanStack Query; **Drizzle**
  (indexer tables read-only, app tables read-write); **Paraglide** i18n (en + ko); **better-auth**
  (Google + optional email); **Base UI via shadcn** + Tailwind.
- **No wallet-connect** — users paste an address; signed-in users can soft-save addresses.
- **Routes:**
  - `/` — overview stats (total pieces, editions, members, recent activity).
  - `/pieces` — global browse: filter by member / edition / class / hidden; sort by release/rarity/supply.
  - `/pieces/$contract` — design detail: metadata, media, serial list, holders.
  - `/address/$address` — collection view: owned pieces, class breakdown, Ruby balance, transfer history.
  - `/activity` — recent transfers/mints.
  - `/leaderboard` — top holders (Phase 2).
  - `/api/*` — oRPC handler.
  - `@$nickname` — profile-by-nickname (Phase 3, after nickname resolution).
- **Components** by domain: `piece/`, `collection/`, `address/`, `activity/`, `filters/`, `auth/`,
  `layout/`, `shared/`.

## 9. Infrastructure

- **`docker-compose.yml`:** Postgres 18, Valkey, indexer, website, worker. Root `.env`
  (RPC URL, DB URL, S3 creds, better-auth secret, Google OAuth client).
- Two Postgres 18 databases behind pgbouncer: `indexer` (via Subsquid migrations) + `main` app (via Drizzle).
- Per-app Dockerfiles (mirroring the reference's website `Dockerfile`).

## 10. Phased roadmap

- **Phase 0 — Foundation:** monorepo scaffold (pnpm + turbo + oxlint/oxfmt + tsconfig),
  `packages/db`, `packages/lib`, `packages/2gathr` stub, docker-compose, `.env`.
  **HTTP-inspection task:** confirm the 2gathr/TopPort API for nickname, Piece Book definitions,
  and class mapping (mitmproxy + agent-browser).
- **Phase 1 — Indexer + core read paths (MVP):** wildcard indexer (Ruby + Piece collections,
  auto-register); worker metadata/media pipeline; website global browse + design detail +
  address collection view + basic activity. Public, en+ko, no accounts.
- **Phase 2 — Accounts & social:** better-auth (Google), saved addresses, lists, leaderboards,
  richer rarity/rollups.
- **Phase 3 — Enrichments:** nickname routes (`@$nickname`), Piece Book progress, real-time
  transfer feed (websocket), compare view.

Each phase is its own spec → plan → implement cycle. **This document details the full architecture
and commits Phase 0–1 as the first buildable slice**; Phases 2–3 are roadmap.

## 11. Open questions / risks

- **Public RPC limits** — 2048-block `eth_getLogs` cap confirmed; rate limits unknown. Mitigations:
  tuned batch range, request throttling, viem-poller fallback. Investigate whether AvaCloud offers a
  keyed/dedicated Titan RPC for higher limits.
- **Class mapping** — `rarity` int → letter not yet confirmed; store raw int now.
- **Serial semantics** — assumed `serial = tokenId`; validate against the app's displayed S/N during
  Phase 1 (a known token like the "S/N 258" example).
- **Nickname & Piece Book** — depend on the private API; confirmed via inspection in Phase 0, delivered
  in Phase 3.
- **New editions** — indexer must keep auto-registering new contracts; verify no assumptions hardcode
  the current edition set.
