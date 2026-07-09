import { Link } from "@tanstack/react-router";

import { ClassBadge } from "@/components/piece/class-badge";
import { CARD_BORDER_WIDTH } from "@/components/piece/piece-grid";
import { PieceMedia } from "@/components/piece/piece-media";
import type { OwnedDesign } from "@/lib/types";

// p-3 (24) + name row text-sm (20) + edition row text-xs (16) + serials row
// text-xs (16) + 2x space-y-1 gap (8) + border. All 3 rows are truncate —
// fixed at 3 lines — so this is exact, not a guess. Feeds PieceGrid's
// row-height estimate.
export const OWNED_DESIGN_CARD_FOOTER_HEIGHT = 24 + 20 + 16 + 16 + 8 + CARD_BORDER_WIDTH;

export function OwnedDesignCard({ owned }: { owned: OwnedDesign }) {
  const { design, serials } = owned;
  const shown = serials.slice(0, 6);
  const extra = serials.length - shown.length;

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
          {/* a holder can only own one piece per design */}
          {/* <Badge variant="secondary">&times;{count}</Badge> */}
          {design.pieceClass && (
            <ClassBadge pieceClass={design.pieceClass}>{design.pieceClass}</ClassBadge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">{design.edition}</p>
        <p
          className="text-muted-foreground truncate text-xs"
          title={serials.map((s) => `#${s}`).join(", ")}
        >
          {shown.map((s) => `#${s}`).join(", ")}
          {extra > 0 && ` +${extra} more`}
        </p>
      </div>
    </Link>
  );
}
