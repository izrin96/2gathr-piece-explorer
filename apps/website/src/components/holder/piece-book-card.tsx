import { Link } from "@tanstack/react-router";

import { PieceMedia } from "@/components/piece/piece-media";
import { Progress } from "@/components/ui/progress";
import type { ResolvedBook } from "@/lib/piece-books";

export function PieceBookCard({ address, book }: { address: string; book: ResolvedBook }) {
  const cover = book.hiddenSlot?.design ?? book.slots[0]?.design;

  return (
    <Link
      to="/address/$address/book/$bookId"
      params={{ address, bookId: book.definition.id }}
      className="bg-card group hover:border-foreground/25 block overflow-hidden rounded-lg border transition-colors"
    >
      {cover && <PieceMedia design={cover} />}
      <div className="space-y-2 p-3">
        <span className="block truncate text-sm font-medium">{book.definition.title}</span>
        <Progress value={book.percent}>
          <span className="text-muted-foreground text-xs tabular-nums">
            {book.collected} / {book.total}
          </span>
        </Progress>
      </div>
    </Link>
  );
}
