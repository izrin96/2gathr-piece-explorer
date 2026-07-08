import { ZERO_ADDRESS } from "@repo/lib";
import { Link } from "@tanstack/react-router";

import { LocalTime } from "@/components/ui/local-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { truncateAddress } from "@/lib/format";
import type { SerialRow } from "@/lib/types";

export function SerialTable({ serials }: { serials: SerialRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Serial</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Minted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {serials.map((s) => (
          <TableRow key={s.serial}>
            <TableCell className="font-mono">#{s.serial}</TableCell>
            <TableCell className="font-mono" title={s.owner}>
              {s.owner === ZERO_ADDRESS ? (
                truncateAddress(s.owner)
              ) : (
                <Link
                  to="/address/$address"
                  params={{ address: s.owner }}
                  className="hover:underline"
                >
                  {truncateAddress(s.owner)}
                </Link>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-right">
              <LocalTime iso={s.mintedAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
