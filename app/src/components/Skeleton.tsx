/** Loading-state primitive (T13R1_DESIGN_CONTRACT.md §4): a shimmering
 * placeholder block, disabled to a static fill under `prefers-reduced-motion`
 * (see the `.skeleton` keyframes/media query in pokemon-tokens.css) —
 * the loading state stays visible, it just stops animating. Distinct from
 * the existing `Loading` text component (StateViews.tsx): use this where a
 * shape (a card, a row, a bar) is about to appear in the same place,
 * `Loading` where only a short status line is needed. */
export function SkeletonBlock({
  width = "100%",
  height = "1em",
  className,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <span
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** A labeled group of skeleton text lines — the group itself carries the
 * `role="status"`/`aria-live` announcement (once, via a visually-hidden
 * label) so a screen reader isn't spammed one line at a time. */
export function SkeletonLines({ lines = 3, label = "Loading…" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className="skeleton-text" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
      <span className="visually-hidden-label">{label}</span>
    </div>
  );
}
