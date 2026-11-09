import { useLayoutEffect, type RefObject } from 'react';

/**
 * Positions the sliding pill (::before) under the active segment button.
 * Reads the pressed button's offsetLeft/offsetWidth and writes them as
 * --pill-x/--pill-w on the container; the pill itself animates in CSS.
 * Re-runs when the active key changes and whenever the container resizes.
 * The active button is found by aria-pressed/aria-checked, so no
 * selection logic changes.
 */
export function useSlidingPill(ref: RefObject<HTMLElement | null>, activeKey: string | number) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const active = el.querySelector<HTMLElement>('[aria-pressed="true"], [aria-checked="true"]');
      if (!active) return;
      el.style.setProperty('--pill-x', `${active.offsetLeft}px`);
      el.style.setProperty('--pill-w', `${active.offsetWidth}px`);
    };
    place();
    // Mark the pill ready only after the first paint, so the first
    // position renders with no transition (no grow-from-left on mount).
    // Later position changes then animate via CSS.
    requestAnimationFrame(() => {
      el.dataset.pillReady = '1';
    });
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, activeKey]);
}
