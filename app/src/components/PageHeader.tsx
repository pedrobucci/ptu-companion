import type { ReactNode } from "react";

/** Shared page-header primitive (T13R1_DESIGN_CONTRACT.md §5/§7): every
 * top-level screen gets a title + optional subtitle + optional right-aligned
 * action row, laid out consistently instead of each page hand-rolling its
 * own `<h1>`/button-row pairing. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions button-row">{actions}</div>}
    </div>
  );
}
