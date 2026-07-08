import { useEffect, useRef } from "react";

// Observes a sentinel element; fires `onIntersect` once it enters the
// viewport (with lead room via rootMargin so loading feels seamless).
// `enabled` should be false while a load is already in flight or there's
// nothing left to load, so the observer doesn't fire repeatedly.
export function useLoadMoreOnScroll(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, enabled]);

  return ref;
}
