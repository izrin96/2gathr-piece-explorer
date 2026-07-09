import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";

import { CollectStatusCard } from "@/components/holder/collect-status-card";
import { PieceGrid } from "@/components/piece/piece-grid";
import { Progress } from "@/components/ui/progress";
import { resolveMemberProgress } from "@/lib/member-progress";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address/members/$member")({
  loader: async ({ context, params }) => {
    const designs = await context.queryClient.ensureQueryData(orpc.pieces.list.queryOptions());
    const hasMember = designs.some((d) => !d.isHidden && d.member === params.member);
    if (!hasMember) throw notFound();
  },
  component: HolderMemberDetail,
});

function HolderMemberDetail() {
  const { address, member } = Route.useParams();
  const { data: designs } = useSuspenseQuery(orpc.pieces.list.queryOptions());
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // parent loader already threw notFound

  const ownedAddresses = new Set(summary.ownedDesigns.map((o) => o.design.contractAddress));
  const progress = resolveMemberProgress(designs, ownedAddresses).find((p) => p.member === member);

  if (!progress) return null; // route loader already threw notFound for unknown members

  return (
    <section className="space-y-6">
      <Link
        to="/address/$address/members"
        params={{ address }}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        Progress
      </Link>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{progress.member}</h1>
        <Progress value={progress.percent}>
          <span className="text-muted-foreground text-sm tabular-nums">
            {progress.collected} / {progress.total}
          </span>
        </Progress>
      </div>
      <PieceGrid
        items={progress.slots}
        getKey={(slot) => slot.design.contractAddress}
        renderItem={(slot) => (
          <CollectStatusCard design={slot.design} isCollected={slot.isCollected} />
        )}
      />
    </section>
  );
}
