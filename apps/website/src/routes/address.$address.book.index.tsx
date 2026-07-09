import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PieceBookCard } from "@/components/holder/piece-book-card";
import { resolveAllBooks } from "@/lib/piece-books";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/book/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions()),
  component: HolderBookTab,
});

function HolderBookTab() {
  const { address } = Route.useParams();
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const ownedAddresses = new Set(summary.ownedDesigns.map((o) => o.design.contractAddress));
  const books = resolveAllBooks(designs, ownedAddresses);

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {books.map((book) => (
        <PieceBookCard key={book.definition.id} address={address} book={book} />
      ))}
    </section>
  );
}
