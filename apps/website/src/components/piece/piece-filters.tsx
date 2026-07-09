import { getRouteApi } from "@tanstack/react-router";

import { filterOptions, type PieceSearch } from "@/lib/filters";
import type { Design } from "@/lib/types";

import { DesignFilterFields, SortSelect } from "./filter-controls";

const route = getRouteApi("/");

export function PieceFilters({ designs }: { designs: Design[] }) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { members, editions } = filterOptions(designs);

  function set<K extends keyof PieceSearch>(key: K, value: PieceSearch[K] | undefined) {
    void navigate({
      search: (prev) => ({ ...prev, [key]: value }),
      replace: true,
      resetScroll: false,
    });
  }

  const hasActiveFilters = search.member != null || search.class != null || search.edition != null;

  function resetFilters() {
    void navigate({
      search: (prev) => ({ ...prev, member: undefined, class: undefined, edition: undefined }),
      replace: true,
      resetScroll: false,
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DesignFilterFields
          members={members}
          editions={editions}
          member={search.member}
          pieceClass={search.class}
          edition={search.edition}
          onMemberChange={(v) => set("member", v)}
          onClassChange={(v) => set("class", v)}
          onEditionChange={(v) => set("edition", v)}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      </div>
      <SortSelect value={search.sort} onChange={(v) => set("sort", v)} />
    </div>
  );
}
