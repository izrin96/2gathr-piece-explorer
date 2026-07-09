import { useEffect, useState } from "react";

// Mirrors the piece grids' `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` breakpoints so
// row-chunking for virtualization always agrees with the CSS column count.
const BREAKPOINTS = [
  { query: "(min-width: 1024px)", columns: 4 },
  { query: "(min-width: 640px)", columns: 3 },
] as const;

function readColumns() {
  for (const breakpoint of BREAKPOINTS) {
    if (window.matchMedia(breakpoint.query).matches) return breakpoint.columns;
  }
  return 2;
}

export function useGridColumns() {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const mediaQueries = BREAKPOINTS.map((b) => window.matchMedia(b.query));
    const update = () => setColumns(readColumns());
    update();
    for (const mql of mediaQueries) mql.addEventListener("change", update);
    return () => {
      for (const mql of mediaQueries) mql.removeEventListener("change", update);
    };
  }, []);

  return columns;
}
