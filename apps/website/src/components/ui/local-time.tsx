import * as React from "react";

import {
  formatLocalDate,
  formatLocalDateTime,
  formatUtcDate,
  formatUtcDateTime,
} from "@/lib/format";

// Renders the UTC string on the first pass (matches SSR output exactly, so
// hydration never mismatches) then swaps to the viewer's local timezone once
// mounted, client-side only.
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "date" | "datetime" }) {
  const [text, setText] = React.useState(() =>
    mode === "date" ? formatUtcDate(iso) : formatUtcDateTime(iso),
  );

  React.useEffect(() => {
    setText(mode === "date" ? formatLocalDate(iso) : formatLocalDateTime(iso));
  }, [iso, mode]);

  return <>{text}</>;
}
