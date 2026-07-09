import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { PieceCard } from "@/components/piece/piece-card";
import { PieceFilters } from "@/components/piece/piece-filters";
import { PieceGrid } from "@/components/piece/piece-grid";
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
      <PieceFilters designs={designs} />
      <p className="text-muted-foreground text-sm">
        {visible.length} of {designs.length} pieces
      </p>
      <PieceGrid
        items={visible}
        getKey={(design) => design.contractAddress}
        renderItem={(design) => <PieceCard design={design} />}
      />
    </div>
  );
}
