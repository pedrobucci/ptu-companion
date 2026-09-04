/** Small, original, hand-authored icon set (T13 restart plan §7 — "lawful
 * iconography", no proprietary assets, no icon-library dependency for a
 * handful of glyphs). Every icon is `currentColor`-based (adapts to theme
 * and any text color automatically) and sized via `em` so it scales with
 * surrounding text. Purely decorative — the adjacent text always carries
 * the meaning, so no icon needs its own accessible name by default. */

export interface IconProps {
  size?: number | string;
  className?: string;
  title?: string;
}

function Svg({
  size = "1em",
  className,
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5 12.8 12.8" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 4v12M4 10h12" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </Svg>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 2.5 18 17H2z" />
      <path d="M10 8v4" />
      <circle cx="10" cy="14.5" r="0.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9.2v5" />
      <circle cx="10" cy="6.3" r="0.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </Svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" />
    </Svg>
  );
}
