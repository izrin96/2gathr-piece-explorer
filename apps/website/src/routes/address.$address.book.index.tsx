import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PieceBookCard } from "@/components/holder/piece-book-card";
import { FilterSelect } from "@/components/piece/filter-controls";
import { filterOptions } from "@/lib/filters";
import { bookSearchSchema, filterBooksByMember, resolveAllBooks } from "@/lib/piece-books";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/book/")({
  validateSearch: bookSearchSchema,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.books.list.queryOptions()),
    ]),
  component: HolderBookTab,
});

function HolderBookTab() {
  const { address } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const { data: bookDefinitions } = useSuspenseQuery(orpc.books.list.queryOptions());
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const { members } = filterOptions(designs);
  const ownedAddresses = new Set(summary.ownedDesigns.map((o) => o.design.contractAddress));
  const books = filterBooksByMember(
    resolveAllBooks(bookDefinitions, designs, ownedAddresses),
    search.member,
  );

  return (
    <section className="space-y-3">
      <FilterSelect
        placeholder="Member"
        allLabel="All members"
        value={search.member}
        options={members}
        onChange={(v) =>
          void navigate({
            search: (prev) => ({ ...prev, member: v }),
            replace: true,
            resetScroll: false,
          })
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((book) => (
          <PieceBookCard key={book.definition.id} address={address} book={book} />
        ))}
      </div>
    </section>
  );
}
