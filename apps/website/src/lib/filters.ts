import { z } from "zod";

import type { Design } from "./types";

// Shared by every page that filters designs by member/class/edition (the `/`
// grid, and the holder page's Pieces + Activity tabs). `.catch(undefined)`
// makes hand-edited/malformed URLs (e.g. `?class=s`) degrade to "no filter"
// instead of throwing in `validateSearch` and erroring the whole page.
export const designFilterSchemaFields = {
  member: z.string().optional().catch(undefined),
  class: z.enum(["S", "A", "B"]).optional().catch(undefined),
  edition: z.string().optional().catch(undefined),
};

export const ownedPieceSearchSchema = z.object(designFilterSchemaFields);
export type DesignFilterSearch = z.infer<typeof ownedPieceSearchSchema>;

// All params optional so unfiltered/default URLs stay clean (`/`, not `/?sort=newest`).
export const pieceSearchSchema = z.object({
  ...designFilterSchemaFields,
  sort: z.enum(["newest", "oldest", "member"]).optional().catch(undefined),
});

export type PieceSearch = z.infer<typeof pieceSearchSchema>;

export function designMatches(design: Design, filters: DesignFilterSearch): boolean {
  return (
    (!filters.member || design.member === filters.member) &&
    (!filters.class || design.pieceClass === filters.class) &&
    (!filters.edition || design.edition === filters.edition)
  );
}

export function filterDesigns(designs: Design[], search: PieceSearch): Design[] {
  return designs.filter((d) => designMatches(d, search));
}

// Designs with a releaseDatetime sort by it; any without one (defensive —
// joinDesigns excludes no-meta collections) sort after, by firstSeenBlock desc.
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
      case "member": {
        if (a.member == null || b.member == null) {
          if (a.member == null && b.member == null) return a.name.localeCompare(b.name);
          return a.member == null ? 1 : -1;
        }
        return a.member.localeCompare(b.member) || a.name.localeCompare(b.name);
      }
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
