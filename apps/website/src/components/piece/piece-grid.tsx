import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import { useGridColumns } from "@/hooks/use-grid-columns";

// Row-chunked virtualization: card height depends on responsive column width and on
// which card component is rendered, so rows are measured (measureElement) rather than
// given a fixed size. initialRect gives SSR/first paint a non-empty grid; scrollMargin
// (the grid's offsetTop) follows TanStack Virtual's window-scroller pattern.
export function PieceGrid<T>({
  items,
  getKey,
  renderItem,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const columns = useGridColumns();
  const parentRef = useRef<HTMLDivElement>(null);
  const parentOffsetRef = useRef(0);

  useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
  }, []);

  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 340,
    overscan: 3,
    scrollMargin: parentOffsetRef.current,
    initialRect: { width: 0, height: 800 },
  });

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
