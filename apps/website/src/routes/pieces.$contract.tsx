import { isAddress } from "@repo/lib";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { CopyIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ClassBadge } from "@/components/piece/class-badge";
import { PieceMedia } from "@/components/piece/piece-media";
import { SerialTable } from "@/components/piece/serial-table";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/ui/local-time";
import { Separator } from "@/components/ui/separator";
import { downloadFile } from "@/lib/download";
import { mediaFilename, pickMediaSource } from "@/lib/media";
import { orpc } from "@/orpc/client";

export const Route = createFileRoute("/pieces/$contract")({
  loader: async ({ context, params }) => {
    if (!isAddress(params.contract)) throw notFound();
    const input = { contract: params.contract };
    const [design] = await Promise.all([
      context.queryClient.ensureQueryData(orpc.pieces.detail.queryOptions({ input })),
      context.queryClient.ensureQueryData(orpc.pieces.serials.queryOptions({ input })),
    ]);
    if (!design) throw notFound();
    return { name: design.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Piece"} · 2GATHR Piece Explorer` }],
  }),
  component: PieceDetailPage,
});

function PieceDetailPage() {
  const { contract } = Route.useParams();
  const input = { contract };
  const { data: design } = useSuspenseQuery(orpc.pieces.detail.queryOptions({ input }));
  const { data: serials } = useSuspenseQuery(orpc.pieces.serials.queryOptions({ input }));
  const [downloading, setDownloading] = useState(false);

  if (!design) return null; // loader already threw notFound

  const media = pickMediaSource(design);
  const filename = mediaFilename(design.name, media);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="relative">
          <PieceMedia design={design} className="rounded-lg border" />
          {media.kind !== "none" && filename && (
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-2 right-2"
              disabled={downloading}
              aria-label="Download media"
              onClick={async () => {
                setDownloading(true);
                await downloadFile(media.src, filename);
                setDownloading(false);
              }}
            >
              {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            </Button>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{design.name}</h1>
            {design.pieceClass && (
              <ClassBadge pieceClass={design.pieceClass}>Class {design.pieceClass}</ClassBadge>
            )}
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            {design.member && <MetaRow label="Member" value={design.member} />}
            <MetaRow label="Edition" value={design.edition} />
            {design.series && <MetaRow label="Series" value={design.series} />}
            {design.type && <MetaRow label="Type" value={design.type} />}
            <MetaRow label="Supply" value={`${design.totalSupply} minted`} />
            {design.price != null && (
              <MetaRow label="Price" value={design.price === 0 ? "Free" : `${design.price} RUBY`} />
            )}
            {design.releaseDatetime && (
              <MetaRow
                label="Released"
                value={<LocalTime iso={design.releaseDatetime} mode="date" />}
              />
            )}
            <MetaRow
              label="Contract"
              value={
                <span className="flex items-center gap-1">
                  <span className="font-mono break-all">{design.contractAddress}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void navigator.clipboard.writeText(design.contractAddress)}
                    aria-label="Copy contract address"
                  >
                    <CopyIcon />
                  </Button>
                </span>
              }
            />
          </dl>
        </div>
      </div>
      <Separator />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Serials ({serials.length})</h2>
        <SerialTable serials={serials} />
      </section>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
