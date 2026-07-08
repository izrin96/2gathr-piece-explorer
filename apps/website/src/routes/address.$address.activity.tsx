import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ActivityTable } from "@/components/holder/activity-table";
import { DesignFilterFields } from "@/components/piece/filter-controls";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLoadMoreOnScroll } from "@/hooks/use-load-more-on-scroll";
import { filterOptions } from "@/lib/filters";
import { activitySearchSchema } from "@/lib/holder";
import type { ActivitySearch } from "@/lib/holder";
import type { PieceClass } from "@/lib/types";
import { orpc } from "@/orpc/client";

const ACTIVITY_TYPES = [
  { value: "all", label: "All activity" },
  { value: "piece", label: "Piece" },
  { value: "ruby", label: "Ruby" },
] as const;

function activityInfiniteOptions(address: string, filters: ActivitySearch) {
  return orpc.holders.activity.infiniteOptions({
    input: (page: number) => ({ address, page, ...filters }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export const Route = createFileRoute("/address/$address/activity")({
  validateSearch: activitySearchSchema,
  loaderDeps: ({ search }) => ({
    type: search.type,
    member: search.member,
    class: search.class,
    edition: search.edition,
  }),
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureInfiniteQueryData(activityInfiniteOptions(params.address, deps)),
  component: HolderActivityTab,
});

function HolderActivityTab() {
  const { address } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    activityInfiniteOptions(address, search),
  );

  const { members, editions } = filterOptions(summary?.ownedDesigns.map((o) => o.design) ?? []);
  const items = data.pages.flatMap((p) => p.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;
  const sentinelRef = useLoadMoreOnScroll(fetchNextPage, hasNextPage && !isFetchingNextPage);

  const hasActiveFilters =
    search.type != null || search.member != null || search.class != null || search.edition != null;

  // Member/class/edition describe a Piece's design — setting one only makes
  // sense with type=Piece, so force it rather than leave a dead-end
  // "Ruby + Member" combo that always returns empty.
  function setDesignFilter(patch: { member?: string; class?: PieceClass; edition?: string }) {
    const forcesPiece = Object.values(patch).some((v) => v != null);
    void navigate({
      search: (prev) => ({ ...prev, ...patch, ...(forcesPiece ? { type: "piece" } : {}) }),
      replace: true,
      resetScroll: false,
    });
  }

  function resetFilters() {
    void navigate({
      search: (prev) => ({
        ...prev,
        type: undefined,
        member: undefined,
        class: undefined,
        edition: undefined,
      }),
      replace: true,
      resetScroll: false,
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={ACTIVITY_TYPES}
          value={search.type ?? "all"}
          onValueChange={(v) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                type: v === "all" ? undefined : (v as ActivitySearch["type"]),
              }),
              replace: true,
              resetScroll: false,
            })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <DesignFilterFields
          members={members}
          editions={editions}
          member={search.member}
          pieceClass={search.class}
          edition={search.edition}
          onMemberChange={(v) => setDesignFilter({ member: v })}
          onClassChange={(v) => setDesignFilter({ class: v })}
          onEditionChange={(v) => setDesignFilter({ edition: v })}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      </div>

      <p className="text-muted-foreground text-sm">{totalCount} events</p>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity.</p>
      ) : (
        <>
          <ActivityTable items={items} />
          {hasNextPage && (
            <>
              <div ref={sentinelRef} />
              {isFetchingNextPage && (
                <p className="text-muted-foreground py-2 text-center text-sm">Loading more…</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
