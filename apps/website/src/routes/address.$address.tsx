import { isAddress, normalizeAddress } from "@repo/lib";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, Outlet, redirect, useMatchRoute } from "@tanstack/react-router";
import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRubyAmount, truncateAddress } from "@/lib/format";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/address/$address")({
  loader: async ({ context, params }) => {
    if (!isAddress(params.address)) throw notFound();
    const address = normalizeAddress(params.address);
    // Canonicalize to lowercase so there's one URL — and one query-cache key — per address.
    if (params.address !== address) {
      throw redirect({ to: "/address/$address", params: { address }, replace: true });
    }
    const summary = await context.queryClient.ensureQueryData(
      orpc.holders.summary.queryOptions({ input: { address } }),
    );
    if (!summary) throw notFound();
    return { address };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${truncateAddress(loaderData?.address ?? "")} · 2GATHR Piece Explorer` }],
  }),
  component: HolderLayout,
});

function HolderLayout() {
  const { address } = Route.useParams();
  const navigate = Route.useNavigate();
  const matchRoute = useMatchRoute();
  const { data: summary } = useSuspenseQuery(
    orpc.holders.summary.queryOptions({ input: { address } }),
  );

  if (!summary) return null; // loader already threw notFound

  const activeTab = matchRoute({ to: "/address/$address/activity" })
    ? "activity"
    : matchRoute({ to: "/address/$address/book" }) ||
        matchRoute({ to: "/address/$address/book/$bookId" })
      ? "book"
      : matchRoute({ to: "/address/$address/members" }) ||
          matchRoute({ to: "/address/$address/members/$member" })
        ? "members"
        : "pieces";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <h1 className="font-mono text-2xl font-semibold break-all">{truncateAddress(address)}</h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void navigator.clipboard.writeText(address)}
            aria-label="Copy address"
          >
            <CopyIcon />
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Ruby balance: {formatRubyAmount(summary.rubyBalanceWei)} RUBY
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          void navigate({
            to:
              v === "activity"
                ? "/address/$address/activity"
                : v === "book"
                  ? "/address/$address/book"
                  : v === "members"
                    ? "/address/$address/members"
                    : "/address/$address",
            params: { address },
            resetScroll: false,
          })
        }
      >
        <TabsList variant="line">
          <TabsTrigger value="pieces">Pieces</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="book">Book</TabsTrigger>
          <TabsTrigger value="members">Progress</TabsTrigger>
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}
