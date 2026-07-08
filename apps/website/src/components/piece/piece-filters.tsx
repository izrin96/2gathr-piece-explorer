import { getRouteApi } from "@tanstack/react-router";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterOptions, type PieceSearch } from "@/lib/filters";
import type { Design } from "@/lib/types";

import { DesignFilterFields } from "./filter-controls";

const route = getRouteApi("/");

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
      <div className="ml-auto">
        <Select
          items={SORTS}
          value={search.sort ?? "newest"}
          onValueChange={(v) =>
            set("sort", v === "newest" ? undefined : (v as PieceSearch["sort"]))
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
