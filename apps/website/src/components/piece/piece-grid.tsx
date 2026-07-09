import { useElementScrollRestoration } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useGridColumns } from "@/hooks/use-grid-columns";

// Mirrors PieceMedia's aspect-[0.7266] (width / height) and __root.tsx's
// `max-w-6xl px-4 sm:px-6` page shell. Combined with the caller's own
// footerHeight (exact — each card's footer is truncate-clamped to a fixed
// line count, see e.g. PIECE_CARD_FOOTER_HEIGHT), row height is knowable
// analytically instead of guessed, so estimateSize is accurate from the very
// first render — no measure-then-correct jump, including right when scroll
// restoration lands on a remount.
const CARD_ASPECT_RATIO = 0.7266;
const GRID_GAP = 16; // gap-4 / pb-4
const MAX_CONTAINER_WIDTH = 1152; // max-w-6xl
const CONTAINER_PADDING = 48; // sm:px-6 both sides

// The card's own border (used by every PieceGrid card component) eats into
// its content box on both axes — footerHeight already accounts for it
// vertically; here it has to come off the width *before* dividing by the
// aspect ratio, or the image-height estimate comes out systematically tall
// (2px narrower image => ~2.75px shorter image at this aspect ratio, which
// otherwise silently compounds into a real scroll-restoration drift).
export const CARD_BORDER_WIDTH = 2;

function estimateRowHeight(columns: number, footerHeight: number) {
  // PieceGrid itself doesn't render (see `mounted` below) until after
  // hydration, so by the time this actually feeds a paint, clientWidth and
  // useGridColumns's columns are both already the real client values.
  // clientWidth (not innerWidth) so the vertical scrollbar's width doesn't
  // get counted as available content space on narrower viewports.
  const viewportWidth = typeof document === "undefined" ? 0 : document.documentElement.clientWidth;
  if (!viewportWidth) return 340;
  const containerWidth = Math.min(viewportWidth, MAX_CONTAINER_WIDTH) - CONTAINER_PADDING;
  const cardWidth = (containerWidth - (columns - 1) * GRID_GAP) / columns;
  const imageWidth = cardWidth - CARD_BORDER_WIDTH;
  return imageWidth / CARD_ASPECT_RATIO + footerHeight + GRID_GAP;
}

// Row-chunked virtualization: card height depends on responsive column width, so rows
// are still measured (measureElement) as a safety net against rounding/font-loading
// drift — but estimateSize itself is computed, not guessed. initialRect gives SSR/first
// paint a non-empty grid; scrollMargin (the grid's offsetTop) follows TanStack Virtual's
// window-scroller pattern.
export function PieceGrid<T>({
  footerHeight,
  items,
  getKey,
  renderItem,
}: {
  // Exact pixel height of this card's footer (padding + fixed truncated
  // line count + border) — see e.g. PIECE_CARD_FOOTER_HEIGHT.
  footerHeight: number;
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const columns = useGridColumns();
  const parentRef = useRef<HTMLDivElement>(null);

  // Server and this component's own first client render both render nothing
  // — matches columns' own SSR-safe start, so there's no hydration mismatch.
  // useGridColumns' effect (declared above, so it runs first) has already
  // corrected columns to the real value by the time this flips true, so the
  // grid never paints with the wrong column count.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // parentRef only attaches once `mounted`. State (not a ref) so measuring it
  // forces the extra render scrollMargin needs — a plain ref update here
  // wouldn't repaint, and nothing else is guaranteed to re-render right after.
  const [parentOffset, setParentOffset] = useState(0);
  useLayoutEffect(() => {
    setParentOffset(parentRef.current?.offsetTop ?? 0);
  }, [mounted]);

  const rowCount = Math.ceil(items.length / columns);

  // On remount the virtualizer starts from offset 0 — without an accurate
  // estimate it renders the wrong rows first and jumps once the router's
  // scroll restoration lands. Seeding initialOffset from the saved scroll
  // entry gets the right rows rendered from the first paint. See TanStack
  // Router's scroll restoration guide, "Manual Scroll Restoration for Window".
  const scrollEntry = useElementScrollRestoration({ getElement: () => window });

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight(columns, footerHeight),
    overscan: 3,
    scrollMargin: parentOffset,
    initialRect: { width: 0, height: 800 },
    initialOffset: scrollEntry?.scrollY,
  });

  if (!mounted) return null;

  return (
    <div ref={parentRef}>
      <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns;
          const rowItems = items.slice(start, start + columns);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 lg:grid-cols-4"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {rowItems.map((item) => (
                <div key={getKey(item)}>{renderItem(item)}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
