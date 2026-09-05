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

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </Svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8v8.5h10V8" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </Svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4.5c1.8-.9 4-.9 6 0v11c-2-.9-4.2-.9-6 0z" />
      <path d="M16 4.5c-1.8-.9-4-.9-6 0v11c2-.9 4.2-.9 6 0z" />
    </Svg>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 4a3.5 3.5 0 0 0-4.6 4.3L3 13.7 6.3 17l5.4-5.4A3.5 3.5 0 0 0 16 7l-2.7 2.7-2-2z" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4" />
    </Svg>
  );
}

/* ---- T13R2 additions (T13R1_DESIGN_CONTRACT.md §3): Creatures, Rosters,
   Items, Storage, Shop, NPC Journal, level-up entry point, Android "More".
   Same hand-authored/currentColor/em convention as above — no icon
   library added. */

export function IconCreatures(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="10" cy="13.2" rx="4" ry="3.2" />
      <circle cx="5.5" cy="7" r="1.6" />
      <circle cx="10" cy="5.5" r="1.7" />
      <circle cx="14.5" cy="7" r="1.6" />
    </Svg>
  );
}

export function IconRoster(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" />
      <rect x="3" y="11" width="6" height="6" rx="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" />
    </Svg>
  );
}

export function IconBag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 8V6a4 4 0 0 1 8 0v2" />
      <rect x="4.5" y="8" width="11" height="9.5" rx="2" />
      <path d="M8 12h4" />
    </Svg>
  );
}

export function IconStorage(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7 10 3.5 17 7 10 10.5z" />
      <path d="M3 7v7l7 3.5 7-3.5V7" />
      <path d="M10 10.5v7" />
    </Svg>
  );
}

export function IconShop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8 4 3.5h12L17 8" />
      <path d="M4 8v8.5h12V8" />
      <path d="M8 16.5V12h4v4.5" />
    </Svg>
  );
}

export function IconJournal(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.5" y="3" width="10" height="14" rx="1.5" />
      <path d="M3.5 5.5h2.5M3.5 8.5h2.5M3.5 11.5h2.5M3.5 14.5h2.5" />
      <path d="M9 6.5h5.5M9 9.5h5.5M9 12.5h3.5" />
    </Svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10 2 12 8 18 10 12 12 10 18 8 12 2 10 8 8Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  );
}
