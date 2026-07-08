import { Link } from "@tanstack/react-router";

import type { Design } from "@/lib/types";

import { ClassBadge } from "./class-badge";
import { PieceMedia } from "./piece-media";

export function PieceCard({ design }: { design: Design }) {
  return (
    <Link
      to="/pieces/$contract"
      params={{ contract: design.contractAddress }}
      className="bg-card group hover:border-foreground/25 overflow-hidden rounded-lg border transition-colors"
    >
      <PieceMedia design={design} />
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{design.name}</span>
          {design.pieceClass && (
            <ClassBadge pieceClass={design.pieceClass}>{design.pieceClass}</ClassBadge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {design.edition} · {design.totalSupply} minted
        </p>
      </div>
    </Link>
  );
}
