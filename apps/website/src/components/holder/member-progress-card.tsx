import { Link } from "@tanstack/react-router";

import { PieceMedia } from "@/components/piece/piece-media";
import { Progress } from "@/components/ui/progress";
import type { ResolvedMemberProgress } from "@/lib/member-progress";

export function MemberProgressCard({
  address,
  progress,
}: {
  address: string;
  progress: ResolvedMemberProgress;
}) {
  const cover = progress.slots[0]?.design;

  return (
    <Link
      to="/address/$address/members/$member"
      params={{ address, member: progress.member }}
      className="bg-card group hover:border-foreground/25 block overflow-hidden rounded-lg border transition-colors"
    >
      {cover && <PieceMedia design={cover} />}
      <div className="space-y-2 p-3">
        <span className="block truncate text-sm font-medium">{progress.member}</span>
        <Progress value={progress.percent}>
          <span className="text-muted-foreground text-xs tabular-nums">
            {progress.collected} / {progress.total}
          </span>
        </Progress>
      </div>
    </Link>
  );
}
