import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { PieceClass } from "@/lib/types";

const CLASS_BADGE_CLASSNAME: Record<PieceClass, string> = {
  S: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  A: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  B: "bg-gray-500/10 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
};

export function ClassBadge({
  pieceClass,
  children,
}: {
  pieceClass: PieceClass;
  children: ReactNode;
}) {
  return (
    <Badge variant="secondary" className={CLASS_BADGE_CLASSNAME[pieceClass]}>
      {children}
    </Badge>
  );
}
