import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRubyAmount } from "@/lib/format";
import type { HolderActivityItem } from "@/lib/types";

// Mint (from=zero) and burn (to=zero) are just directional transfers with no
// counterparty; everything else is a plain received/sent.
function pieceVerb(direction: "in" | "out", counterparty: string | null): string {
  if (counterparty === null) return direction === "in" ? "Minted" : "Burned";
  return direction === "in" ? "Received" : "Sent";
}

export function ActivityTable({ items }: { items: HolderActivityItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Detail</TableHead>
          {/* cannot transfer to other holder yet */}
          {/* <TableHead>Counterparty</TableHead> */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-muted-foreground">
              <LocalTime iso={item.timestamp} />
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={
                  item.kind === "piece"
                    ? "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-transparent bg-pink-500/10 text-pink-600 dark:text-pink-400"
                }
              >
                {item.kind === "piece" ? "Piece" : "Ruby"}
              </Badge>
            </TableCell>
            <TableCell>
              {item.kind === "piece" ? (
                <span>
                  {pieceVerb(item.direction, item.counterparty)}{" "}
                  <Link
                    to="/pieces/$contract"
                    params={{ contract: item.contractAddress }}
                    className="hover:underline"
                  >
                    {item.designName}
                  </Link>{" "}
                  #{item.serial}
                  {item.priceWei && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatRubyAmount(item.priceWei)} RUBY
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  {item.direction === "in" ? "Received" : "Sent"} {formatRubyAmount(item.amountWei)}{" "}
                  RUBY
                </span>
              )}
            </TableCell>
            {/* <TableCell className="font-mono">
              {item.counterparty ? (
                <Link
                  to="/address/$address"
                  params={{ address: item.counterparty }}
                  className="hover:underline"
                  title={item.counterparty}
                >
                  {truncateAddress(item.counterparty)}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell> */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
