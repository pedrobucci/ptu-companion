/** Original, neutral field-guide illustration. No character/art data is invented. */
export function Avatar({ label, className, kind = "trainer" }: {
  label: string; className?: string; kind?: "trainer" | "creature";
}) {
  return (
    <span className={`avatar portrait-${kind} ${className ?? ""}`} role="img" aria-label={`${label} — no portrait`}>
      <svg viewBox="0 0 160 160" fill="none" aria-hidden="true">
        <path className="portrait-orbit" d="M18 80a62 62 0 1 1 124 0 62 62 0 1 1-124 0M80 8v16M80 136v16M8 80h16M136 80h16" />
        {kind === "trainer" ? <>
          <path className="portrait-fill" d="M35 145c1-31 16-46 45-46s44 15 45 46" />
          <circle className="portrait-fill" cx="80" cy="65" r="27" />
          <path className="portrait-line" d="m61 103 19 19 19-19M80 123v23" />
        </> : <>
          <path className="portrait-fill" d="m80 31 42 24v49l-42 25-42-25V55Z" />
          <circle className="portrait-line" cx="80" cy="80" r="23" />
          <path className="portrait-line" d="M56 80h48M80 56v48" />
          <circle className="portrait-core" cx="80" cy="80" r="9" />
        </>}
      </svg>
    </span>
  );
}
