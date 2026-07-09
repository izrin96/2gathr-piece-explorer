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

// Starting at 2 (rather than reading matchMedia synchronously) is required to
// keep the very first hydration pass SSR-safe. But that same conservative
// start also runs on every later client-side navigation remount — a needless
// rowCount hop (e.g. 75 -> 38 rows) right as scroll restoration is trying to
// land, which reflows the virtualized grid mid-restore. Once the app has
// painted client-side once, later mounts can read the real value immediately.
let hasHydrated = false;

// Anything else computing from live viewport state (e.g. PieceGrid's row-height
// estimate) needs the same hydration gate, or it'll mismatch the server's
// fallback on the very first client render and throw a hydration error.
export function hasClientHydrated() {
  return hasHydrated;
}

function initialColumns() {
  if (typeof window === "undefined" || !hasHydrated) return 2;
  return readColumns();
}

export function useGridColumns() {
  const [columns, setColumns] = useState(initialColumns);

  useEffect(() => {
    hasHydrated = true;
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
