import { Link } from "@tanstack/react-router";

import { CARD_BORDER_WIDTH } from "@/components/piece/piece-grid";
import { PieceMedia } from "@/components/piece/piece-media";
import type { Design } from "@/lib/types";
import { cn } from "@/lib/utils";

// p-2 (16) + name row text-xs (16) + border. Row is truncate — fixed at 1
// line — so this is exact, not a guess. Feeds PieceGrid's row-height estimate.
export const COLLECT_STATUS_CARD_FOOTER_HEIGHT = 16 + 16 + CARD_BORDER_WIDTH;

// One design, collected or not. This is a public explorer and isHidden designs are already
// unfiltered and fully visible elsewhere (`/`, `/pieces/$contract`), so a "?" mystery treatment
// for an uncollected design would only be inconsistent, not actually private.
export function CollectStatusCard({
  design,
  isCollected,
}: {
  design: Design;
  isCollected: boolean;
}) {
  return (
    <Link to="/pieces/$contract" params={{ contract: design.contractAddress }} className="block">
      <div
        className={cn(
          "bg-card overflow-hidden rounded-lg border transition-colors",
          isCollected ? "hover:border-foreground/25" : "opacity-35 hover:opacity-50",
        )}
      >
        <PieceMedia design={design} />
        <div className="p-2">
          <span className="block truncate text-xs font-medium">{design.name}</span>
        </div>
      </div>
    </Link>
  );
}
