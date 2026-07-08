# Website Pieces MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fresh `apps/website` — `/` is a latest-first grid of all Piece designs with URL-driven filters/sort, `/pieces/$contract` is the design detail with media, metadata, and serial list.

**Architecture:** TanStack Start (SSR) app. oRPC procedures read the two Drizzle clients (`indexer` read-only + app `db`), join the two databases **in code** (they cannot be SQL-joined), and return all ~154 designs in one payload; filtering/sorting runs client-side from URL search params. A single `PieceMedia` component owns the media rule: `animationUrl` (mp4) → autoplaying video, else original `imageUrl`, **never** `thumbnailUrl`.

**Tech Stack:** TanStack Start + React 19, Tailwind v4, shadcn CLI with the Base UI distribution (`base-nova` style, stock neutral theme), oRPC + TanStack Query, Drizzle via `@repo/db`, zod v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-website-pieces-mvp-design.md`

## Global Constraints

- **pnpm only** (never npm/yarn/bun); Node runtime.
- **Dependency versions:** website-only deps are pinned in `apps/website/package.json` (via `pnpm add`, which writes `^x.y.z`). Only genuinely shared deps use `catalog:` / `catalog:dev`: `drizzle-orm`, `zod`, `typescript`, `vite`, `vitest`, `@types/node`. Do **not** add website deps to `pnpm-workspace.yaml`.
- **Imports:** the website uses `moduleResolution: bundler` (via `@repo/tsconfig/tsconfig.react.json`), so relative imports are **extensionless** and `@/*` maps to `src/*`. (The repo's `.js`-extension rule applies to the nodenext packages, not this app.)
- The rarity tier is called **class** (S/A/B) — never "grade". No marketplace language anywhere (no floor/buy/sell).
- `indexer` Drizzle client is **read-only**; never write to it, never SQL-join across the two DBs.
- Stock shadcn styling only: default neutral theme, default radius, no custom design tokens.
- Dates render **pinned to UTC** (deterministic SSR — the mockup hit a hydration mismatch here).
- Dev stack must be up for manual verification: `docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer`; root `.env` copied from `.env.example`.
- Lint = `oxlint --type-aware` (clean run prints nothing, check exit code); format = oxfmt.
- Conventional Commit messages. All work on branch `feat/website`.

## Data facts (verified live, 2026-07-08)

- 154 rows in indexer `piece_collection` (`id` = contract address, `edition` = e.g. `"2025 Season 1"`, `symbol` = `"AtHeart"`, `total_supply`, `first_seen_block`).
- 150 rows in app-DB `piece_design_meta` (4 designs unenriched). `member` can be `""` (treat as null). `edition` values: `2025 Season 1`, `2026 Season 1/2/3`, `2026 HBD`, `Welcome`, `Hidden Piece`. `class` ∈ S/A/B. 20 rows have `animation_url` (mp4). `release_datetime` is never null when the row exists.
- `piece_token`: ≤512 rows per collection (median ~24) — serial lists need no pagination.

---

### Task 1: Scaffold `apps/website` (TanStack Start boots)

**Files:**

- Create: `apps/website/package.json`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/vite.config.ts`
- Create: `apps/website/.gitignore`
- Create: `apps/website/src/styles/app.css`
- Create: `apps/website/src/router.tsx`
- Create: `apps/website/src/routes/__root.tsx`
- Create: `apps/website/src/routes/index.tsx`

**Interfaces:**

- Produces: a booting TanStack Start app on port 3000; `getRouter()` with a `QueryClient` in router context (`{ queryClient: QueryClient }`) that every later route loader consumes via `context.queryClient`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/website
```

- [ ] **Step 2: Write `apps/website/package.json`** (workspace + shared-catalog deps only; app-specific deps are added by `pnpm add` in Step 8 so they get real pinned versions)

```json
{
  "name": "website",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix",
    "typecheck": "tsc --noEmit",
    "format": "oxfmt .",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/lib": "workspace:*",
    "drizzle-orm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/lint": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "@types/node": "catalog:dev",
    "typescript": "catalog:dev",
    "vite": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

- [ ] **Step 3: Write `apps/website/tsconfig.json`**

```json
{
  "extends": "@repo/tsconfig/tsconfig.react.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"],
  "exclude": ["node_modules", "dist", ".turbo"]
}
```

- [ ] **Step 4: Write `apps/website/vite.config.ts`** (loads the root `.env` so `@repo/db` clients find `DATABASE_URL`/`INDEXER_DATABASE_URL`)

```ts
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  process.env.DATABASE_URL ??= env.DATABASE_URL;
  process.env.INDEXER_DATABASE_URL ??= env.INDEXER_DATABASE_URL;

  return {
    plugins: [tanstackStart(), react(), tailwindcss()],
    server: { port: 3000 },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
  };
});
```

- [ ] **Step 5: Write `apps/website/.gitignore`**

```
src/routeTree.gen.ts
.output
.nitro
.tanstack
```

- [ ] **Step 6: Write the minimal app shell**

`apps/website/src/styles/app.css` (Task 2 replaces this with the shadcn theme):

```css
@import "tailwindcss";
```

`apps/website/src/router.tsx` — TanStack Start requires a `getRouter` export returning a fresh router per call (server: per-request; client: once):

```tsx
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
  return routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      context: { queryClient },
      defaultPreload: "intent",
      scrollRestoration: true,
    }),
    queryClient,
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

`apps/website/src/routes/__root.tsx`:

```tsx
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "2GATHR Piece Explorer" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-dvh">
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
```

`apps/website/src/routes/index.tsx` (placeholder — Task 7 replaces it):

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <p>2GATHR Piece Explorer</p>,
});
```

- [ ] **Step 7: Install workspace deps**

```bash
pnpm install
```

- [ ] **Step 8: Add website-only deps (pinned in the app's package.json, NOT the catalog)**

```bash
pnpm --filter website add react react-dom @tanstack/react-router @tanstack/react-start @tanstack/react-query @tanstack/react-router-with-query @orpc/server @orpc/client @orpc/tanstack-query
pnpm --filter website add -D @vitejs/plugin-react @tailwindcss/vite tailwindcss @types/react @types/react-dom
```

- [ ] **Step 9: Boot the dev server and verify**

```bash
pnpm --filter website dev
```

Run in background, wait ~10s, then:

```bash
curl -s http://localhost:3000/ | grep -o "2GATHR Piece Explorer" | head -1
```

Expected: `2GATHR Piece Explorer` (SSR HTML). The dev server also generates `src/routeTree.gen.ts` (git-ignored), which typecheck needs.

- [ ] **Step 10: Typecheck**

```bash
pnpm --filter website typecheck
```

Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/website pnpm-lock.yaml
git commit -m "feat(website): scaffold TanStack Start app"
```

---

### Task 2: shadcn (Base UI) + stock theme

**Files:**

- Create: `apps/website/components.json`
- Modify: `apps/website/src/styles/app.css` (replaced by shadcn init/add output)
- Create: `apps/website/src/lib/utils.ts` (generated `cn`)
- Create: `apps/website/src/components/ui/*.tsx` (generated)

**Interfaces:**

- Produces: `cn()` from `@/lib/utils`; stock shadcn components `Badge`, `Button`, `Select` (+subcomponents), `Table` (+subcomponents), `Skeleton`, `Separator` importable from `@/components/ui/<name>`; the stock neutral light/dark CSS variables in `app.css`.

- [ ] **Step 1: Write `apps/website/components.json`** (pre-writing this skips the CLI's interactive prompts; `base-nova` is the shadcn Base UI distribution style — it installs `@base-ui/react` primitives)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/app.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Add the components** (run from the app dir so the CLI picks up components.json)

```bash
cd apps/website && pnpm dlx shadcn@latest add badge button select table skeleton separator && cd ../..
```

Expected: files under `src/components/ui/`, `src/lib/utils.ts`, `src/styles/app.css` rewritten with `@import "tailwindcss"`, the theme variables, and dark-mode variant; `@base-ui/react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `shadcn` added to `apps/website/package.json` by the CLI. If the CLI asks anything, accept defaults (stock neutral). Do **not** hand-edit the generated theme — stock is the point.

- [ ] **Step 3: Verify the theme applied**

```bash
grep -c -- "--background" apps/website/src/styles/app.css
```

Expected: ≥2 (light + dark blocks). Then restart dev server and confirm the page still renders:

```bash
curl -s http://localhost:3000/ | grep -o "2GATHR Piece Explorer" | head -1
```

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm --filter website typecheck && pnpm --filter website lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/website pnpm-lock.yaml
git commit -m "feat(website): shadcn base-nova init with stock neutral theme"
```

---

### Task 3: Domain types + two-DB join (`joinDesigns`)

**Files:**

- Create: `apps/website/src/lib/types.ts`
- Create: `apps/website/src/lib/designs.ts`
- Test: `apps/website/src/lib/designs.test.ts`

**Interfaces:**

- Consumes: `normalizeAddress` from `@repo/lib`.
- Produces:
  - `types.ts`: `PieceClass = "S" | "A" | "B"`; `Design` and `SerialRow` interfaces (exact shapes below) — the wire format every later task uses.
  - `designs.ts`: `formatDesignName(member: string, designNumber: number): string`; `joinDesigns(collections: CollectionRow[], metas: MetaRow[]): Design[]` plus the exported `CollectionRow`/`MetaRow` input interfaces (what Task 6 maps DB rows into).

- [ ] **Step 1: Write `apps/website/src/lib/types.ts`**

```ts
export type PieceClass = "S" | "A" | "B";

// One Piece design (one ERC-721 contract), joined from the indexer DB
// (piece_collection) and the app DB (piece_design_meta). Meta fields are
// null for the handful of unenriched designs.
export interface Design {
  contractAddress: string; // normalized lowercase 0x…
  name: string; // "Bome #005", or "<edition> · <symbol>" when unenriched
  member: string | null;
  designNumber: number | null;
  pieceClass: PieceClass | null;
  edition: string; // "2025 Season 1" … (meta edition, else indexer edition)
  series: string | null;
  type: string | null;
  totalSupply: number;
  firstSeenBlock: number;
  releaseDatetime: string | null; // ISO
  imageUrl: string | null; // original image — never the thumbnail
  animationUrl: string | null; // mp4 when present
  isHidden: boolean;
}

export interface SerialRow {
  serial: number;
  owner: string;
  mintedAt: string; // ISO
}
```

- [ ] **Step 2: Write the failing test `apps/website/src/lib/designs.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { formatDesignName, joinDesigns } from "./designs";

const collection = {
  id: "0xAbCd000000000000000000000000000000000001",
  edition: "2025 Season 1",
  symbol: "AtHeart",
  totalSupply: 100,
  firstSeenBlock: 500,
};

const meta = {
  contractAddress: "0xabcd000000000000000000000000000000000001",
  member: "Bome",
  designNumber: 5,
  edition: "2025 Season 1",
  classLetter: "S",
  series: "AtHeart",
  type: "Image",
  releaseDatetime: "2025-03-14T00:00:00.000Z",
  imageUrl: "https://cdn.example/bome5.png",
  animationUrl: null,
  isHidden: false,
};

describe("formatDesignName", () => {
  it("pads the design number to three digits", () => {
    expect(formatDesignName("Bome", 5)).toBe("Bome #005");
    expect(formatDesignName("Seohyeon", 123)).toBe("Seohyeon #123");
  });
});

describe("joinDesigns", () => {
  it("joins collection and meta by normalized address", () => {
    const [d] = joinDesigns([collection], [meta]);
    expect(d).toMatchObject({
      contractAddress: "0xabcd000000000000000000000000000000000001",
      name: "Bome #005",
      member: "Bome",
      pieceClass: "S",
      edition: "2025 Season 1",
      totalSupply: 100,
      imageUrl: "https://cdn.example/bome5.png",
    });
  });

  it("falls back to indexer fields when meta is missing", () => {
    const [d] = joinDesigns([collection], []);
    expect(d).toMatchObject({
      name: "2025 Season 1 · AtHeart",
      member: null,
      pieceClass: null,
      edition: "2025 Season 1",
      releaseDatetime: null,
      imageUrl: null,
      isHidden: false,
    });
  });

  it("treats empty-string member as null (falls back to plain name)", () => {
    const [d] = joinDesigns([collection], [{ ...meta, member: "" }]);
    expect(d?.member).toBeNull();
    expect(d?.name).toBe("2025 Season 1 · AtHeart");
  });

  it("ignores unknown class letters", () => {
    const [d] = joinDesigns([collection], [{ ...meta, classLetter: "X" }]);
    expect(d?.pieceClass).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

```bash
pnpm --filter website test
```

Expected: FAIL — `designs` module not found.

- [ ] **Step 4: Write `apps/website/src/lib/designs.ts`**

```ts
import { normalizeAddress } from "@repo/lib";

import type { Design, PieceClass } from "./types";

// Raw shapes the oRPC procedures map DB rows into before joining.
export interface CollectionRow {
  id: string;
  edition: string;
  symbol: string;
  totalSupply: number;
  firstSeenBlock: number;
}

export interface MetaRow {
  contractAddress: string;
  member: string | null;
  designNumber: number | null;
  edition: string;
  classLetter: string | null;
  series: string | null;
  type: string | null;
  releaseDatetime: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  isHidden: boolean | null;
}

const PIECE_CLASSES = new Set<string>(["S", "A", "B"]);

export function formatDesignName(member: string, designNumber: number): string {
  return `${member} #${String(designNumber).padStart(3, "0")}`;
}

// The indexer DB and app DB cannot be SQL-joined — join in code by address.
export function joinDesigns(collections: CollectionRow[], metas: MetaRow[]): Design[] {
  const metaByAddress = new Map(metas.map((m) => [normalizeAddress(m.contractAddress), m]));

  return collections.map((c) => {
    const address = normalizeAddress(c.id);
    const meta = metaByAddress.get(address);
    const member = meta?.member ? meta.member : null;
    const pieceClass =
      meta?.classLetter && PIECE_CLASSES.has(meta.classLetter)
        ? (meta.classLetter as PieceClass)
        : null;

    return {
      contractAddress: address,
      name:
        member && meta?.designNumber != null
          ? formatDesignName(member, meta.designNumber)
          : `${c.edition} · ${c.symbol}`,
      member,
      designNumber: meta?.designNumber ?? null,
      pieceClass,
      edition: meta?.edition ?? c.edition,
      series: meta?.series ?? null,
      type: meta?.type ?? null,
      totalSupply: c.totalSupply,
      firstSeenBlock: c.firstSeenBlock,
      releaseDatetime: meta?.releaseDatetime ?? null,
      imageUrl: meta?.imageUrl ?? null,
      animationUrl: meta?.animationUrl ?? null,
      isHidden: meta?.isHidden ?? false,
    };
  });
}
```

- [ ] **Step 5: Run the tests — expect pass**

```bash
pnpm --filter website test
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib
git commit -m "feat(website): domain types + two-DB design join"
```

---

### Task 4: URL search schema + filter/sort logic

**Files:**

- Create: `apps/website/src/lib/filters.ts`
- Test: `apps/website/src/lib/filters.test.ts`

**Interfaces:**

- Consumes: `Design` from `@/lib/types`.
- Produces:
  - `pieceSearchSchema` — zod object `{ member?: string; class?: "S"|"A"|"B"; edition?: string; sort?: "newest"|"oldest"|"name" }` (all optional; absent params = no filter, newest sort — keeps URLs clean).
  - `PieceSearch = z.infer<typeof pieceSearchSchema>`.
  - `filterDesigns(designs: Design[], search: PieceSearch): Design[]`
  - `sortDesigns(designs: Design[], sort: PieceSearch["sort"]): Design[]` — returns a new array.
  - `filterOptions(designs: Design[]): { members: string[]; editions: string[] }` — distinct, alphabetical.

- [ ] **Step 1: Write the failing test `apps/website/src/lib/filters.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import type { Design } from "./types";
import { filterDesigns, filterOptions, sortDesigns } from "./filters";

function design(overrides: Partial<Design>): Design {
  return {
    contractAddress: "0x0000000000000000000000000000000000000001",
    name: "Bome #001",
    member: "Bome",
    designNumber: 1,
    pieceClass: "B",
    edition: "2025 Season 1",
    series: "AtHeart",
    type: "Image",
    totalSupply: 10,
    firstSeenBlock: 100,
    releaseDatetime: "2025-01-01T00:00:00.000Z",
    imageUrl: null,
    animationUrl: null,
    isHidden: false,
    ...overrides,
  };
}

const bome = design({ name: "Bome #001" });
const arin = design({
  name: "Arin #002",
  member: "Arin",
  pieceClass: "S",
  edition: "2026 Season 2",
  releaseDatetime: "2026-02-01T00:00:00.000Z",
  firstSeenBlock: 900,
});
const unenriched = design({
  name: "2025 Season 1 · AtHeart",
  member: null,
  pieceClass: null,
  releaseDatetime: null,
  firstSeenBlock: 500,
});

describe("filterDesigns", () => {
  it("returns everything when no filters set", () => {
    expect(filterDesigns([bome, arin, unenriched], {})).toHaveLength(3);
  });

  it("filters by member, class, and edition", () => {
    expect(filterDesigns([bome, arin], { member: "Arin" })).toEqual([arin]);
    expect(filterDesigns([bome, arin], { class: "S" })).toEqual([arin]);
    expect(filterDesigns([bome, arin], { edition: "2025 Season 1" })).toEqual([bome]);
  });
});

describe("sortDesigns", () => {
  it("newest first by releaseDatetime; unenriched last by firstSeenBlock desc", () => {
    const other = design({ ...unenriched, firstSeenBlock: 600 });
    const sorted = sortDesigns([unenriched, bome, other, arin], "newest");
    expect(sorted.map((d) => d.name)).toEqual([
      "Arin #002",
      "Bome #001",
      "2025 Season 1 · AtHeart",
      "2025 Season 1 · AtHeart",
    ]);
    expect(sorted[2]?.firstSeenBlock).toBe(600);
  });

  it("oldest reverses enriched order, unenriched still last", () => {
    const sorted = sortDesigns([arin, unenriched, bome], "oldest");
    expect(sorted.map((d) => d.name)).toEqual([
      "Bome #001",
      "Arin #002",
      "2025 Season 1 · AtHeart",
    ]);
  });

  it("name sorts alphabetically", () => {
    const sorted = sortDesigns([bome, arin], "name");
    expect(sorted.map((d) => d.name)).toEqual(["Arin #002", "Bome #001"]);
  });

  it("defaults to newest when sort is undefined", () => {
    const sorted = sortDesigns([bome, arin], undefined);
    expect(sorted[0]?.name).toBe("Arin #002");
  });
});

describe("filterOptions", () => {
  it("collects distinct members and editions, sorted, skipping nulls", () => {
    expect(filterOptions([bome, arin, unenriched])).toEqual({
      members: ["Arin", "Bome"],
      editions: ["2025 Season 1", "2026 Season 2"],
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter website test
```

Expected: FAIL — `filters` module not found.

- [ ] **Step 3: Write `apps/website/src/lib/filters.ts`**

```ts
import { z } from "zod";

import type { Design } from "./types";

// All params optional so unfiltered/default URLs stay clean (`/`, not `/?sort=newest`).
export const pieceSearchSchema = z.object({
  member: z.string().optional(),
  class: z.enum(["S", "A", "B"]).optional(),
  edition: z.string().optional(),
  sort: z.enum(["newest", "oldest", "name"]).optional(),
});

export type PieceSearch = z.infer<typeof pieceSearchSchema>;

export function filterDesigns(designs: Design[], search: PieceSearch): Design[] {
  return designs.filter(
    (d) =>
      (!search.member || d.member === search.member) &&
      (!search.class || d.pieceClass === search.class) &&
      (!search.edition || d.edition === search.edition),
  );
}

// Enriched designs sort by releaseDatetime; the few without meta always sort
// after them, ordered by firstSeenBlock desc.
export function sortDesigns(designs: Design[], sort: PieceSearch["sort"]): Design[] {
  const enriched = designs.filter((d) => d.releaseDatetime !== null);
  const unenriched = designs
    .filter((d) => d.releaseDatetime === null)
    .toSorted((a, b) => b.firstSeenBlock - a.firstSeenBlock);

  const sorted = enriched.toSorted((a, b) => {
    switch (sort ?? "newest") {
      case "newest":
        return (b.releaseDatetime ?? "").localeCompare(a.releaseDatetime ?? "");
      case "oldest":
        return (a.releaseDatetime ?? "").localeCompare(b.releaseDatetime ?? "");
      case "name":
        return a.name.localeCompare(b.name);
    }
  });

  return [...sorted, ...unenriched];
}

export function filterOptions(designs: Design[]): { members: string[]; editions: string[] } {
  const members = new Set<string>();
  const editions = new Set<string>();
  for (const d of designs) {
    if (d.member) members.add(d.member);
    editions.add(d.edition);
  }
  return {
    members: [...members].toSorted(),
    editions: [...editions].toSorted(),
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter website test
```

Expected: PASS (all tests, including Task 3's).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib
git commit -m "feat(website): URL search schema + filter/sort logic"
```

---

### Task 5: Media selection + formatting helpers

**Files:**

- Create: `apps/website/src/lib/media.ts`
- Create: `apps/website/src/lib/format.ts`
- Test: `apps/website/src/lib/media.test.ts`
- Test: `apps/website/src/lib/format.test.ts`

**Interfaces:**

- Produces:
  - `media.ts`: `MediaSource` union and `pickMediaSource(d: { animationUrl: string | null; imageUrl: string | null }): MediaSource` — the spec's media rule in one pure function.
  - `format.ts`: `truncateAddress(addr: string): string` (`0x1234…cdef`), `formatUtcDate(iso: string): string` (e.g. `Mar 14, 2025`, pinned UTC), `formatUtcDateTime(iso: string): string` (e.g. `Mar 14, 2025, 08:30 UTC`).

- [ ] **Step 1: Write the failing tests**

`apps/website/src/lib/media.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pickMediaSource } from "./media";

describe("pickMediaSource", () => {
  it("prefers the animation, with the original image as poster", () => {
    expect(
      pickMediaSource({
        animationUrl: "https://cdn.example/a.mp4",
        imageUrl: "https://cdn.example/a.png",
      }),
    ).toEqual({
      kind: "video",
      src: "https://cdn.example/a.mp4",
      poster: "https://cdn.example/a.png",
    });
  });

  it("uses the original image when there is no animation", () => {
    expect(pickMediaSource({ animationUrl: null, imageUrl: "https://cdn.example/a.png" })).toEqual({
      kind: "image",
      src: "https://cdn.example/a.png",
    });
  });

  it("returns none when there is no media at all", () => {
    expect(pickMediaSource({ animationUrl: null, imageUrl: null })).toEqual({ kind: "none" });
  });

  it("plays the animation even without a poster image", () => {
    expect(pickMediaSource({ animationUrl: "https://cdn.example/a.mp4", imageUrl: null })).toEqual({
      kind: "video",
      src: "https://cdn.example/a.mp4",
      poster: null,
    });
  });
});
```

`apps/website/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatUtcDate, formatUtcDateTime, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(truncateAddress("0xabcd001122334455667788990011223344556677")).toBe("0xabcd…6677");
  });
});

describe("formatUtcDate", () => {
  it("formats pinned to UTC regardless of host timezone", () => {
    expect(formatUtcDate("2025-03-14T23:30:00.000Z")).toBe("Mar 14, 2025");
  });
});

describe("formatUtcDateTime", () => {
  it("includes the time and a UTC marker", () => {
    expect(formatUtcDateTime("2025-03-14T23:30:00.000Z")).toBe("Mar 14, 2025, 23:30 UTC");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter website test
```

Expected: FAIL — `media` / `format` modules not found.

- [ ] **Step 3: Write the implementations**

`apps/website/src/lib/media.ts`:

```ts
// The media rule (spec §4): animation first, else the ORIGINAL image.
// thumbnailUrl is never used anywhere in the website.
export type MediaSource =
  | { kind: "video"; src: string; poster: string | null }
  | { kind: "image"; src: string }
  | { kind: "none" };

export function pickMediaSource(d: {
  animationUrl: string | null;
  imageUrl: string | null;
}): MediaSource {
  if (d.animationUrl) return { kind: "video", src: d.animationUrl, poster: d.imageUrl };
  if (d.imageUrl) return { kind: "image", src: d.imageUrl };
  return { kind: "none" };
}
```

`apps/website/src/lib/format.ts`:

```ts
// All date formatting is pinned to UTC: SSR and client must produce identical
// strings or React hydration fails (the old mockup hit exactly this).
const utcDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const utcDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatUtcDate(iso: string): string {
  return utcDate.format(new Date(iso));
}

export function formatUtcDateTime(iso: string): string {
  return `${utcDateTime.format(new Date(iso))} UTC`;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter website test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib
git commit -m "feat(website): media selection rule + UTC-pinned formatting"
```

---

### Task 6: oRPC router, server route, and client

**Files:**

- Create: `apps/website/src/orpc/router.ts`
- Create: `apps/website/src/orpc/client.ts`
- Create: `apps/website/src/routes/api.rpc.$.ts`

**Interfaces:**

- Consumes: `joinDesigns`, `CollectionRow`, `MetaRow` from `@/lib/designs`; `Design`, `SerialRow` from `@/lib/types`; `db`/`schema` from `@repo/db`; `indexer`/`indexerSchema` from `@repo/db/indexer`; `isAddress`, `normalizeAddress` from `@repo/lib`.
- Produces:
  - `router.pieces.list` → `Design[]` (all designs, unsorted — client sorts).
  - `router.pieces.detail({ contract: string })` → `Design | null`.
  - `router.pieces.serials({ contract: string })` → `SerialRow[]` (serial ascending).
  - `orpc` TanStack Query utils from `@/orpc/client` — routes call `orpc.pieces.list.queryOptions()`, `orpc.pieces.detail.queryOptions({ input: { contract } })`, `orpc.pieces.serials.queryOptions({ input: { contract } })`.

- [ ] **Step 1: Write `apps/website/src/orpc/router.ts`**

```ts
import { os } from "@orpc/server";
import { db, schema } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { isAddress, normalizeAddress } from "@repo/lib";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { CollectionRow, MetaRow } from "@/lib/designs";
import { joinDesigns } from "@/lib/designs";
import type { SerialRow } from "@/lib/types";

const contractInput = z.object({
  contract: z.string().refine(isAddress, "not an address").transform(normalizeAddress),
});

function toMetaRow(m: typeof schema.pieceDesignMeta.$inferSelect): MetaRow {
  return {
    contractAddress: m.contractAddress,
    member: m.member,
    designNumber: m.designNumber,
    edition: m.edition,
    classLetter: m.classLetter,
    series: m.series,
    type: m.type,
    releaseDatetime: m.releaseDatetime,
    imageUrl: m.imageUrl,
    animationUrl: m.animationUrl,
    isHidden: m.isHidden,
  };
}

function toCollectionRow(c: typeof indexerSchema.pieceCollection.$inferSelect): CollectionRow {
  return {
    id: c.id,
    edition: c.edition,
    symbol: c.symbol,
    totalSupply: c.totalSupply,
    firstSeenBlock: c.firstSeenBlock,
  };
}

export const router = {
  pieces: {
    // All ~154 designs in one payload; filtering/sorting is client-side (spec §3).
    list: os.handler(async () => {
      const [collections, metas] = await Promise.all([
        indexer.select().from(indexerSchema.pieceCollection),
        db.select().from(schema.pieceDesignMeta),
      ]);
      return joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow));
    }),

    detail: os.input(contractInput).handler(async ({ input }) => {
      const [collections, metas] = await Promise.all([
        indexer
          .select()
          .from(indexerSchema.pieceCollection)
          .where(eq(indexerSchema.pieceCollection.id, input.contract)),
        db
          .select()
          .from(schema.pieceDesignMeta)
          .where(eq(schema.pieceDesignMeta.contractAddress, input.contract)),
      ]);
      const designs = joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow));
      return designs[0] ?? null;
    }),

    serials: os.input(contractInput).handler(async ({ input }): Promise<SerialRow[]> => {
      const tokens = await indexer
        .select({
          serial: indexerSchema.pieceToken.serial,
          owner: indexerSchema.pieceToken.owner,
          mintedAt: indexerSchema.pieceToken.mintedAt,
        })
        .from(indexerSchema.pieceToken)
        .where(eq(indexerSchema.pieceToken.collectionId, input.contract))
        .orderBy(asc(indexerSchema.pieceToken.serial));

      return tokens.map((t) => ({
        serial: Number(t.serial),
        owner: normalizeAddress(t.owner),
        mintedAt: t.mintedAt.toISOString(),
      }));
    }),
  },
};
```

Note: `pieceToken.serial` is Postgres `numeric` (Drizzle returns a string) and `mintedAt` is a `Date` — both are converted to the `SerialRow` wire types here. `collectionId` equals the collection's contract address (the indexer uses the address as `piece_collection.id`).

- [ ] **Step 2: Write `apps/website/src/routes/api.rpc.$.ts`**

```ts
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";

import { router } from "@/orpc/router";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: "/api/rpc",
          context: {},
        });
        return response ?? new Response("Not Found", { status: 404 });
      },
    },
  },
});
```

- [ ] **Step 3: Write `apps/website/src/orpc/client.ts`** (isomorphic: SSR calls procedures in-process, the browser goes over HTTP)

```ts
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";

import { router } from "./router";

const getORPCClient = createIsomorphicFn()
  .server(() => createRouterClient(router))
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({ url: `${window.location.origin}/api/rpc` });
    return createORPCClient(link);
  });

export const client: RouterClient<typeof router> = getORPCClient();
export const orpc = createTanstackQueryUtils(client);
```

- [ ] **Step 4: Verify against the live dev stack**

Dev stack must be running (`docker compose up -d postgres postgres-indexer valkey pgbouncer pgbouncer-indexer`). Restart the dev server, then:

```bash
curl -s -X POST http://localhost:3000/api/rpc/pieces/list -H 'content-type: application/json' -d '{}' | head -c 400
```

Expected: a JSON payload whose data is an array of design objects (`contractAddress`, `name`, `member`, …). Spot-check the count:

```bash
curl -s -X POST http://localhost:3000/api/rpc/pieces/list -H 'content-type: application/json' -d '{}' | grep -o 'contractAddress' | wc -l
```

Expected: 154 (or slightly more if new designs dropped since).

- [ ] **Step 5: Typecheck + lint + test**

```bash
pnpm --filter website typecheck && pnpm --filter website lint && pnpm --filter website test
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src
git commit -m "feat(website): oRPC router + isomorphic client + /api/rpc handler"
```

---

### Task 7: Pieces grid at `/` (PieceMedia + PieceCard + header)

**Files:**

- Create: `apps/website/src/components/piece/piece-media.tsx`
- Create: `apps/website/src/components/piece/piece-card.tsx`
- Create: `apps/website/src/components/layout/site-header.tsx`
- Modify: `apps/website/src/routes/__root.tsx` (mount header)
- Modify: `apps/website/src/routes/index.tsx` (replace placeholder)

**Interfaces:**

- Consumes: `orpc` from `@/orpc/client`; `pickMediaSource` from `@/lib/media`; `filterDesigns`/`sortDesigns`/`pieceSearchSchema` from `@/lib/filters`; `Design` from `@/lib/types`; `Badge` from `@/components/ui/badge`; `cn` from `@/lib/utils`.
- Produces: `PieceMedia({ design, className })` (used again by Task 9's hero); `PieceCard({ design })`; `SiteHeader()`; the `/` route with `validateSearch: pieceSearchSchema` whose search params Task 8's filter bar reads/writes.

- [ ] **Step 1: Write `apps/website/src/components/piece/piece-media.tsx`**

```tsx
import { useState } from "react";

import { pickMediaSource } from "@/lib/media";
import type { Design } from "@/lib/types";
import { cn } from "@/lib/utils";

// The ONLY place piece media renders. Animation (mp4) wins; otherwise the
// original image; thumbnailUrl is never used. Video error falls back to the
// image; no media (or image error) falls back to a neutral placeholder.
export function PieceMedia({
  design,
  className,
}: {
  design: Pick<Design, "name" | "imageUrl" | "animationUrl">;
  className?: string;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const media = pickMediaSource(design);
  const showVideo = media.kind === "video" && !videoFailed;
  const imageSrc = media.kind === "image" ? media.src : videoFailed ? design.imageUrl : null;

  return (
    <div className={cn("bg-muted relative aspect-[0.7266] overflow-hidden", className)}>
      {showVideo ? (
        <video
          src={media.src}
          poster={media.poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : imageSrc && !imageFailed ? (
        <img
          src={imageSrc}
          alt={design.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-2 text-center text-sm">
          {design.name}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `apps/website/src/components/piece/piece-card.tsx`**

```tsx
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import type { Design } from "@/lib/types";

import { PieceMedia } from "./piece-media";

export function PieceCard({ design }: { design: Design }) {
  return (
    <Link
      to="/pieces/$contract"
      params={{ contract: design.contractAddress }}
      className="bg-card group overflow-hidden rounded-lg border transition-colors hover:border-foreground/25"
    >
      <PieceMedia design={design} />
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{design.name}</span>
          {design.pieceClass && <Badge variant="secondary">{design.pieceClass}</Badge>}
        </div>
        <p className="text-muted-foreground text-xs">
          {design.edition} · {design.totalSupply} minted
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Write `apps/website/src/components/layout/site-header.tsx`** and mount it

```tsx
import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link to="/" className="text-sm font-semibold">
          2GATHR Piece Explorer
        </Link>
      </div>
    </header>
  );
}
```

In `apps/website/src/routes/__root.tsx`, import it and render above `<main>`:

```tsx
import { SiteHeader } from "@/components/layout/site-header";
```

```tsx
<div className="min-h-dvh">
  <SiteHeader />
  <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Outlet />
  </main>
</div>
```

- [ ] **Step 4: Replace `apps/website/src/routes/index.tsx`** (loader SSRs the full list; filters/sort derive in-memory from URL params — Task 8 adds the filter bar into the marked slot)

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { PieceCard } from "@/components/piece/piece-card";
import { filterDesigns, pieceSearchSchema, sortDesigns } from "@/lib/filters";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/")({
  validateSearch: pieceSearchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions()),
  component: PiecesPage,
});

function PiecesPage() {
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const search = Route.useSearch();

  const visible = useMemo(
    () => sortDesigns(filterDesigns(designs, search), search.sort),
    [designs, search],
  );

  return (
    <div className="space-y-6">
      {/* Task 8 mounts <PieceFilters designs={designs} /> here */}
      <p className="text-muted-foreground text-sm">
        {visible.length} of {designs.length} pieces
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((design) => (
          <PieceCard key={design.contractAddress} design={design} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

Restart the dev server, then:

```bash
curl -s http://localhost:3000/ | grep -c "pieces/0x"
```

Expected: ≥100 (SSR'd card links). Open `http://localhost:3000/` and confirm: grid renders latest-first, the ~20 animated designs autoplay their mp4s, static designs show the original image (verify in devtools that **no** request goes to a `thumbnail` URL), URL params like `/?class=S` filter the grid (hand-edit the URL — no UI yet).

- [ ] **Step 6: Typecheck + lint**

```bash
pnpm --filter website typecheck && pnpm --filter website lint
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src
git commit -m "feat(website): latest-first pieces grid at / with SSR"
```

---

### Task 8: Filter/sort bar

**Files:**

- Create: `apps/website/src/components/piece/piece-filters.tsx`
- Modify: `apps/website/src/routes/index.tsx` (mount the bar)

**Interfaces:**

- Consumes: `filterOptions`, `PieceSearch` from `@/lib/filters`; `Design` from `@/lib/types`; the `/` route's search params (`Route.useSearch`, navigate); shadcn `Select` from `@/components/ui/select`.
- Produces: `PieceFilters({ designs })` — writes `member`/`class`/`edition`/`sort` into the URL (deleting a param when "All"/default is chosen).

- [ ] **Step 1: Write `apps/website/src/components/piece/piece-filters.tsx`**

Uses the route API so navigation is typed against `/`'s search schema. Each select maps the sentinel `"all"` back to `undefined` so cleared filters disappear from the URL. Check the generated `select.tsx` for the exact exported names (base-nova exports `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) and adjust imports if the generated API differs.

```tsx
import { getRouteApi } from "@tanstack/react-router";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterOptions, type PieceSearch } from "@/lib/filters";
import type { Design } from "@/lib/types";

const route = getRouteApi("/");

const CLASSES = ["S", "A", "B"] as const;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
] as const;

export function PieceFilters({ designs }: { designs: Design[] }) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { members, editions } = filterOptions(designs);

  function set<K extends keyof PieceSearch>(key: K, value: PieceSearch[K] | undefined) {
    void navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        placeholder="Member"
        value={search.member}
        options={members}
        onChange={(v) => set("member", v)}
      />
      <FilterSelect
        placeholder="Class"
        value={search.class}
        options={CLASSES}
        onChange={(v) => set("class", v as PieceSearch["class"])}
      />
      <FilterSelect
        placeholder="Edition"
        value={search.edition}
        options={editions}
        onChange={(v) => set("edition", v)}
      />
      <div className="ml-auto">
        <Select
          value={search.sort ?? "newest"}
          onValueChange={(v) =>
            set("sort", v === "newest" ? undefined : (v as PieceSearch["sort"]))
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? undefined : v)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {placeholder.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Mount it in `apps/website/src/routes/index.tsx`** — replace the Task 8 comment:

```tsx
import { PieceFilters } from "@/components/piece/piece-filters";
```

```tsx
<PieceFilters designs={designs} />
```

- [ ] **Step 3: Verify in the browser**

On `http://localhost:3000/`: pick a member → URL becomes `/?member=Bome` and the grid narrows; pick class S → `&class=S`; switch sort to Oldest → `&sort=oldest`; set everything back to All/Newest → params disappear from the URL; browser back/forward replays filter states; reloading a filtered URL SSRs the filtered view.

- [ ] **Step 4: Typecheck + lint + test**

```bash
pnpm --filter website typecheck && pnpm --filter website lint && pnpm --filter website test
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src
git commit -m "feat(website): URL-driven member/class/edition filters + sort"
```

---

### Task 9: Piece detail page

**Files:**

- Create: `apps/website/src/components/piece/serial-table.tsx`
- Create: `apps/website/src/routes/pieces.$contract.tsx`
- Modify: `apps/website/src/routes/__root.tsx` (add `notFoundComponent` + `errorComponent`)

**Interfaces:**

- Consumes: `orpc` from `@/orpc/client`; `PieceMedia`; `isAddress` from `@repo/lib`; `truncateAddress`, `formatUtcDate`, `formatUtcDateTime` from `@/lib/format`; `SerialRow` from `@/lib/types`; shadcn `Table` components, `Badge`, `Separator`.
- Produces: the `/pieces/$contract` route; `SerialTable({ serials })`.

- [ ] **Step 1: Write `apps/website/src/components/piece/serial-table.tsx`**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUtcDateTime, truncateAddress } from "@/lib/format";
import type { SerialRow } from "@/lib/types";

export function SerialTable({ serials }: { serials: SerialRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Serial</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Minted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {serials.map((s) => (
          <TableRow key={s.serial}>
            <TableCell className="font-mono">#{s.serial}</TableCell>
            <TableCell className="font-mono" title={s.owner}>
              {truncateAddress(s.owner)}
            </TableCell>
            <TableCell className="text-muted-foreground text-right">
              {formatUtcDateTime(s.mintedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Write `apps/website/src/routes/pieces.$contract.tsx`**

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isAddress } from "@repo/lib";
import type { ReactNode } from "react";

import { PieceMedia } from "@/components/piece/piece-media";
import { SerialTable } from "@/components/piece/serial-table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatUtcDate } from "@/lib/format";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/pieces/$contract")({
  loader: async ({ context, params }) => {
    if (!isAddress(params.contract)) throw notFound();
    const input = { contract: params.contract };
    const [design] = await Promise.all([
      context.queryClient.ensureQueryData(orpc.pieces.detail.queryOptions({ input })),
      context.queryClient.ensureQueryData(orpc.pieces.serials.queryOptions({ input })),
    ]);
    if (!design) throw notFound();
    return { name: design.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Piece"} · 2GATHR Piece Explorer` }],
  }),
  component: PieceDetailPage,
});

function PieceDetailPage() {
  const { contract } = Route.useParams();
  const input = { contract };
  const { data: design } = useSuspenseQuery(orpc.pieces.detail.queryOptions({ input }));
  const { data: serials } = useSuspenseQuery(orpc.pieces.serials.queryOptions({ input }));

  if (!design) return null; // loader already threw notFound

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]">
        <PieceMedia design={design} className="rounded-lg border" />
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{design.name}</h1>
            {design.pieceClass && <Badge variant="secondary">Class {design.pieceClass}</Badge>}
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            {design.member && <MetaRow label="Member" value={design.member} />}
            <MetaRow label="Edition" value={design.edition} />
            {design.series && <MetaRow label="Series" value={design.series} />}
            {design.type && <MetaRow label="Type" value={design.type} />}
            <MetaRow label="Supply" value={`${design.totalSupply} minted`} />
            {design.releaseDatetime && (
              <MetaRow label="Released" value={formatUtcDate(design.releaseDatetime)} />
            )}
            <MetaRow
              label="Contract"
              value={<span className="font-mono break-all">{design.contractAddress}</span>}
            />
          </dl>
        </div>
      </div>
      <Separator />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Serials ({serials.length})</h2>
        <SerialTable serials={serials} />
      </section>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
```

- [ ] **Step 3: Add 404/error components to `apps/website/src/routes/__root.tsx`** — add to the route options:

```tsx
  notFoundComponent: () => (
    <div className="text-muted-foreground py-16 text-center text-sm">
      This piece does not exist.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="text-muted-foreground py-16 text-center text-sm">
      Something went wrong. {error.message}
    </div>
  ),
```

- [ ] **Step 4: Verify in the browser**

- Click a card from `/` → detail renders media (animated designs autoplay), metadata, and the full serial table with truncated mono owner addresses and UTC mint times.
- `http://localhost:3000/pieces/not-an-address` → the 404 component (invalid address).
- `http://localhost:3000/pieces/0x0000000000000000000000000000000000000001` → 404 (unknown contract).
- Reload a real detail URL → fully SSR'd (view-source shows the serial rows).

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pieces/not-an-address
```

Expected: `404`.

- [ ] **Step 5: Typecheck + lint + test**

```bash
pnpm --filter website typecheck && pnpm --filter website lint && pnpm --filter website test
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src
git commit -m "feat(website): piece detail page with media, metadata, serial list"
```

---

### Task 10: Repo docs + full verification

**Files:**

- Modify: `CLAUDE.md` (catalog policy line, layout line, status section)

**Interfaces:**

- Consumes: everything — this is the integration gate.

- [ ] **Step 1: Amend `CLAUDE.md`**

Replace the catalog convention line:

```markdown
- **Dependency versions**: pnpm catalogs (`pnpm-workspace.yaml`) hold only genuinely shared deps
  (typescript, vite, vitest, @types/node, drizzle-orm, zod, pg, turbo, tsx) as `catalog:` /
  `catalog:dev`; app-specific deps are pinned directly in that app's `package.json`.
```

In **Layout**, change `website (TanStack Start, planned)` to `website (TanStack Start, built)`, and note in the layout notes that `apps/website` uses `moduleResolution: bundler` (extensionless relative imports + `@/` alias — the `.js`-extension rule applies to the nodenext packages).

Append to **Status**:

```markdown
**Website pieces MVP** (spec `docs/superpowers/specs/2026-07-08-website-pieces-mvp-design.md`):
`apps/website` (TanStack Start SSR + stock shadcn Base UI + oRPC/TanStack Query) serves `/`
(latest-first design grid, URL-driven member/class/edition filters + sort) and
`/pieces/$contract` (media, metadata, serial list). Media rule: `animationUrl` mp4 → autoplay
video, else original `imageUrl`, never `thumbnailUrl`. Holder/address pages, activity, search,
auth, i18n deferred.
```

- [ ] **Step 2: Full-repo verification**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter website build
```

Expected: all exit 0 (oxlint prints nothing on success — check exit codes).

- [ ] **Step 3: Final manual pass**

With the dev stack up, run `pnpm --filter website dev` and walk: `/` (grid latest-first, animations autoplay, no thumbnail requests in the network tab) → filter to `?member=Bome&class=B` → open a piece → back (filters preserved) → reload detail (SSR). Confirm both light and dark (OS preference) render legibly.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catalog policy + website status in CLAUDE.md"
```

Then use the superpowers:finishing-a-development-branch skill to decide merge/PR.
