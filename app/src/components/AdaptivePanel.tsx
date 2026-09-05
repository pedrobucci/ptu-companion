import { useEffect, useId, useRef } from "react";
import "./AdaptivePanel.css";

/**
 * One adaptive `<dialog>`-based panel used for every description/detail
 * popup in the app (move/ability text, provenance detail, cart summaries).
 * Renders as a centered popover on wide viewports and a bottom sheet on
 * narrow ones via CSS alone (see AdaptivePanel.css) — this is a single
 * implementation, not separate desktop/Android components; see the T08
 * Worker Result for why that's an acceptable simplification for v1.
 *
 * Uses the native `<dialog>` element for free focus handling, Escape-to-close,
 * and backdrop semantics instead of a custom modal implementation.
 */
export function AdaptivePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // T13R2 a11y fix: a <dialog>'s accessible name is never inferred from an
  // inner heading automatically — without this, every AdaptivePanel usage
  // (move/ability detail, provenance, the new mobile "More" sheet) reached
  // assistive tech as an unnamed dialog. One id, reused by every caller.
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adaptive-panel"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="adaptive-panel-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="adaptive-panel-body">{children}</div>
    </dialog>
  );
}
