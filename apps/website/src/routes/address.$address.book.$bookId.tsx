import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";

import { PieceBookSlotCard } from "@/components/holder/piece-book-slot-card";
import { Progress } from "@/components/ui/progress";
import { PIECE_BOOKS, resolveAllBooks } from "@/lib/piece-books";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/book/$bookId")({
  loader: async ({ context, params }) => {
    if (!PIECE_BOOKS.some((b) => b.id === params.bookId)) throw notFound();
    await context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions());
  },
  component: HolderBookDetail,
});

function HolderBookDetail() {
  const { address, bookId } = Route.useParams();
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const ownedAddresses = new Set(summary.ownedDesigns.map((o) => o.design.contractAddress));
  const book = resolveAllBooks(designs, ownedAddresses).find((b) => b.definition.id === bookId);

  if (!book) return null; // route loader already threw notFound for unknown ids

  return (
    <section className="space-y-6">
      <Link
        to="/address/$address/book"
        params={{ address }}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        Piece Book
      </Link>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{book.definition.title}</h1>
        <Progress value={book.percent}>
          <span className="text-muted-foreground text-sm tabular-nums">
            {book.collected} / {book.total}
          </span>
        </Progress>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
        {book.slots.map((slot) => (
          <PieceBookSlotCard key={slot.design.contractAddress} slot={slot} />
        ))}
      </div>
      {book.hiddenSlot && (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">
            Hidden Piece — complete the book to unlock
          </h2>
          <div className="max-w-40">
            <PieceBookSlotCard slot={book.hiddenSlot} />
          </div>
        </div>
      )}
    </section>
  );
}
