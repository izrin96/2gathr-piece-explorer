import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  OWNED_DESIGN_CARD_FOOTER_HEIGHT,
  OwnedDesignCard,
} from "@/components/holder/owned-design-card";
import { DesignFilterFields } from "@/components/piece/filter-controls";
import { PieceGrid } from "@/components/piece/piece-grid";
import { designMatches, filterOptions, ownedPieceSearchSchema } from "@/lib/filters";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/")({
  validateSearch: ownedPieceSearchSchema,
  component: HolderPiecesTab,
});

function HolderPiecesTab() {
  const { address } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const { members, editions } = filterOptions(summary.ownedDesigns.map((o) => o.design));
  const visible = summary.ownedDesigns.filter((o) => designMatches(o.design, search));
  const hasActiveFilters = search.member != null || search.class != null || search.edition != null;

  function set<K extends keyof typeof search>(key: K, value: (typeof search)[K]) {
    void navigate({
      search: (prev) => ({ ...prev, [key]: value }),
      replace: true,
      resetScroll: false,
    });
  }

  function resetFilters() {
    void navigate({
      search: (prev) => ({ ...prev, member: undefined, class: undefined, edition: undefined }),
      replace: true,
      resetScroll: false,
    });
  }

  return (
    <section className="space-y-3">
      {summary.ownedDesigns.length > 0 && (
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
      )}
      <p className="text-muted-foreground text-sm">
        {visible.length} of {summary.totalOwned} pieces
      </p>
      {summary.ownedDesigns.length === 0 ? (
        <p className="text-muted-foreground text-sm">This address owns no pieces.</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">No pieces match these filters.</p>
      ) : (
        <PieceGrid
          footerHeight={OWNED_DESIGN_CARD_FOOTER_HEIGHT}
          items={visible}
          getKey={(owned) => owned.design.contractAddress}
          renderItem={(owned) => <OwnedDesignCard owned={owned} />}
        />
      )}
    </section>
  );
}
