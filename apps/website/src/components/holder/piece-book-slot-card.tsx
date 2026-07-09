import { Link } from "@tanstack/react-router";

import { PieceMedia } from "@/components/piece/piece-media";
import type { BookSlot } from "@/lib/piece-books";
import { cn } from "@/lib/utils";

// One book slot, regular or hidden bonus — same treatment for both. This is a
// public explorer and isHidden designs are already unfiltered and fully
// visible elsewhere (`/`, `/pieces/$contract`), so a "?" mystery card here
// would only be inconsistent, not actually private.
export function PieceBookSlotCard({ slot }: { slot: BookSlot }) {
  const { design, isCollected } = slot;

  const content = (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-lg border transition-colors",
        isCollected ? "hover:border-foreground/25" : "opacity-50 grayscale",
      )}
    >
      <PieceMedia design={design} />
      <div className="p-2">
        <span className="block truncate text-xs font-medium">{design.name}</span>
      </div>
    </div>
  );

  if (!isCollected) return content;

  return (
    <Link to="/pieces/$contract" params={{ contract: design.contractAddress }} className="block">
      {content}
    </Link>
  );
}
