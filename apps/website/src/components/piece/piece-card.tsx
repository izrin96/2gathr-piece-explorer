import { Link } from "@tanstack/react-router";

import type { Design } from "@/lib/types";

import { ClassBadge } from "./class-badge";
import { CARD_BORDER_WIDTH } from "./piece-grid";
import { PieceMedia } from "./piece-media";

// p-3 (24) + name row text-sm (20) + space-y-1 gap (4) + edition row text-xs
// (16) + border. Both text rows are truncate — fixed at 2 lines — so this is
// exact, not a guess. Feeds PieceGrid's row-height estimate.
export const PIECE_CARD_FOOTER_HEIGHT = 24 + 20 + 4 + 16 + CARD_BORDER_WIDTH;

export function PieceCard({ design }: { design: Design }) {
  return (
    <Link
      to="/pieces/$contract"
      params={{ contract: design.contractAddress }}
      className="bg-card group hover:border-foreground/25 block overflow-hidden rounded-lg border transition-colors"
    >
      <PieceMedia design={design} />
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{design.name}</span>
          {design.pieceClass && (
            <ClassBadge pieceClass={design.pieceClass}>{design.pieceClass}</ClassBadge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">
          {design.edition} · {design.totalSupply} minted
        </p>
      </div>
    </Link>
  );
}
