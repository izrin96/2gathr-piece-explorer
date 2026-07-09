import { Link } from "@tanstack/react-router";

import { ClassBadge } from "@/components/piece/class-badge";
import { PieceMedia } from "@/components/piece/piece-media";
import type { OwnedDesign } from "@/lib/types";

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
