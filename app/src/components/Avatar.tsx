/** T13C2: identity-anchor avatar for Trainer/creature hero rows, matching
 * the references' circular portrait slot. No portrait art ships with the
 * app (T13R1_DESIGN_CONTRACT.md §10.8 media policy — no proprietary sprite
 * substitute), so this always renders initials over a brand-gradient
 * circle rather than a broken-image icon or a fabricated picture. */
export function Avatar({ label, className }: { label: string; className?: string }) {
  const initials =
    label
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span className={`avatar${className ? ` ${className}` : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
