import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { PieceCard } from "@/components/piece/piece-card";
import { PieceFilters } from "@/components/piece/piece-filters";
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((design) => (
          <PieceCard key={design.contractAddress} design={design} />
        ))}
      </div>
    </div>
  );
}
