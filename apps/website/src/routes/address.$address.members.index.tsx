import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { MemberProgressCard } from "@/components/holder/member-progress-card";
import { resolveMemberProgress } from "@/lib/member-progress";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/members/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions()),
  component: HolderMembersTab,
});

function HolderMembersTab() {
  const { address } = Route.useParams();
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const ownedAddresses = new Set(summary.ownedDesigns.map((o) => o.design.contractAddress));
  const members = resolveMemberProgress(designs, ownedAddresses);

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((progress) => (
        <MemberProgressCard key={progress.member} address={address} progress={progress} />
      ))}
    </section>
  );
}
