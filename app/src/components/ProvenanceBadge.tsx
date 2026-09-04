import { useState } from "react";
import { AdaptivePanel } from "./AdaptivePanel";

/** Small inline indicator for provenance/quality (spec 2.2/37): tap/click a
 * derived or GM-modified value to see where it came from. Used across
 * content cards and GM-grant displays so a value's origin is never hidden. */
export function ProvenanceBadge({
  label,
  detail,
  variant = "info",
}: {
  label: string;
  detail: React.ReactNode;
  variant?: "info" | "review" | "gm";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`provenance-badge provenance-badge-${variant}`} onClick={() => setOpen(true)}>
        {label}
      </button>
      <AdaptivePanel open={open} onClose={() => setOpen(false)} title="Provenance">
        {detail}
      </AdaptivePanel>
    </>
  );
}
