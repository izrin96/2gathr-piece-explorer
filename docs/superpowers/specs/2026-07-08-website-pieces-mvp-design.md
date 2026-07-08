# 2GATHR Explorer Website — Pieces MVP design

**Date:** 2026-07-08
**Status:** Approved (brainstormed with user)
**Supersedes:** the removed mockup (`f5b13fb` deleted it; this build is fully fresh and ports no
code from it) and, for `apps/website` specifics, section 8 of the 2026-07-04 architecture spec.

## 1. Goal & scope

Build the real `apps/website` with exactly two pages:

- **`/` — pieces list.** No homepage/landing page: the root route _is_ the latest-first grid of
  all Piece designs, with member/class/edition filters and a sort control.
- **`/pieces/$contract` — piece detail.** Media hero, design metadata, and the minted-serial list
  with current owner addresses (plain text, unlinked).

**Non-goals (deferred):** holder/address pages, activity feed, leaderboard, text search,
better-auth, Paraglide i18n, media mirroring, theme toggle, marketplace anything (Pieces are
custodial app-gacha; no floor/buy/sell language).

Dataset reality (live DB, 2026-07-08): 154 designs on chain, 150 with TopPort meta — the 4 without
meta are the earliest deployments (test contracts, user-confirmed) and are excluded from the
website entirely, so the site lists 150. Max 512 serials per design (median ~24), 20 designs with
mp4 animations. Catalog-sized, not feed-sized — this drives the fetch-all approach below.

## 2. Stack

- **TanStack Start** (Vite plugin, React 19, Node server output — never Bun).
- **Tailwind v4** via `@tailwindcss/vite`.
- **shadcn CLI with the Base UI distribution** (`@base-ui/react` primitives). **Stock shadcn
  styling**: default neutral theme, default radius, default font stack, standard light/dark CSS
  variables following system preference. No custom design tokens day one — the design language
  evolves incrementally on top of pure shadcn.
- **oRPC + TanStack Query** for data; **Drizzle** clients from `@repo/db` (`indexer` read-only +
  app `db`); `@repo/lib` for address utils; zod for validation; lucide-react icons.

### Dependency version policy (repo-wide change)

pnpm catalogs are **only for genuinely cross-workspace deps** (typescript, vite, vitest,
@types/node, drizzle-orm, zod, pg, turbo, tsx). Website-only deps (react, `@tanstack/*`,
tailwind, `@base-ui/react`, orpc, lucide-react, …) are versioned directly in
`apps/website/package.json`. Amend the CLAUDE.md line "never pin a version in a package's
package.json" to state this policy.

## 3. Routes & data flow

| Route               | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `/`                 | Pieces list (grid + filters + sort)         |
| `/pieces/$contract` | Piece detail (media, metadata, serial list) |
| `/api/rpc/*`        | oRPC handler (Start server route)           |

- Filter/sort state lives in **URL search params**, validated with zod via TanStack Router
  `validateSearch` (e.g. `/?member=Bome&class=S&sort=oldest`). URLs are shareable; back/forward
  works.
- oRPC's TanStack Query integration provides query options; route **loaders call
  `queryClient.ensureQueryData(...)`** so both pages SSR fully and hydrate without refetching.

### Approach: fetch-all, filter client-side

`pieces.list` returns **all designs in one payload** (~154 rows, tens of KB). Filtering and
sorting run in memory in the route component, derived from URL params — filter changes are
instant, no refetch. If the catalog ever outgrows this, the URL-param contract stays and only the
procedure internals change to SQL filtering.

### oRPC procedures

- **`pieces.list`** — designs = indexer `piece_collection` (id, edition, symbol, totalSupply,
  firstSeenBlock) joined **in code** with app-DB `piece_design_meta` by contract address (the two
  databases cannot be SQL-joined; one query each, join in JS).
- **`pieces.detail`** — input `{ contract }` (normalized, validated): one collection + its meta.
- **`pieces.serials`** — input `{ contract }`: `piece_token` rows for the collection
  (serial, owner, mintedAt), serial ascending. ≤512 rows; no pagination.

Sort options: **newest** (default, `releaseDatetime` desc), **oldest**, **name A–Z**. Filters are
**single-value** URL params day one (one member, one class, one edition at a time); multi-select
can come later without breaking URLs. Hidden designs (`isHidden`) are shown, but **designs with no
`piece_design_meta` row are excluded entirely** (the 4 earliest collections are test contracts —
user-confirmed 2026-07-08); their detail URLs 404.

## 4. Components

```
apps/website/src/components/
  ui/        # shadcn-generated primitives (button, select, badge, table, skeleton…)
  layout/    # site-header: site name + minimal nav
  piece/     # PieceMedia, PieceCard, PieceFilters, detail-page pieces
```

### PieceMedia — the media rule (single source of truth)

Priority order, implemented once and used by both card and hero (`size` prop):

1. `animationUrl` present → `<video autoplay muted loop playsInline preload="metadata"
poster={imageUrl}>`.
2. Otherwise `imageUrl` (the **original** image) in `<img loading="lazy">`.
3. Video error → fall back to the image; image absent/error → neutral placeholder
   (muted box with the design name).

**`thumbnailUrl` is never used.** Grid perf: day one relies on `preload="metadata"` + native lazy
images; an IntersectionObserver play-only-in-viewport pass is a later optimization if needed.

### Other components

- **PieceCard** — media + name, member, class badge (S/A/B — always "class", never "grade"),
  edition, supply. Links to detail.
- **PieceFilters** — member / class / edition controls + sort select (stock shadcn
  `Select`/`ToggleGroup`), reading/writing URL search params.
- **Detail page** — media hero + metadata panel (member, class, edition, series, type, supply,
  release date, contract address in mono with copy affordance) + serial table
  (`#serial · owner · minted at`), owner addresses as plain monospace text.

## 5. Error handling

- `$contract` validated with `isAddress`/`normalizeAddress` from `@repo/lib`; invalid or unknown
  contract → TanStack Router `notFound()` + 404 component. Root route gets a default
  `errorComponent`.
- Designs with no `piece_design_meta` row are excluded from `pieces.list` and `pieces.detail`
  entirely (`joinDesigns` skips them); their detail route resolves to `null` and the loader throws
  `notFound()`.
- oRPC inputs zod-validated. The `indexer` Drizzle client is read-only — never write, never cross
  the two DBs (repo rule).

## 6. Testing

TDD per repo convention (failing test → minimal impl → pass), Vitest:

- Pure logic gets unit tests: filter/sort functions, media-source selection, the two-DB
  join/mapping.
- oRPC procedures stay thin wrappers over those tested functions; full-stack behavior is verified
  against the live dev stack (`docker compose` services + real indexer data), not mocked-DB tests.
