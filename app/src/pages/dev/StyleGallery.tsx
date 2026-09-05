import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { AdaptivePanel } from "../../components/AdaptivePanel";
import { HpBar } from "../../components/HpBar";
import { TypeBadge, MoveCategoryBadge } from "../../components/TypeBadge";
import { ItemCategoryBadge } from "../../components/ItemCategoryBadge";
import { StatBadge } from "../../components/StatBadge";
import { SkeletonLines } from "../../components/Skeleton";
import { Empty, ErrorState, Loading } from "../../components/StateViews";
import { IconBag, IconCreatures, IconRoster, IconShop, IconWarning } from "../../components/icons";
import { Avatar } from "../../components/Avatar";

/** T13R2 verification fixture (plan scope: "a reference gallery/dev route
 * ... used only for verification, covering every shared state without
 * duplicating business rules"). Every value on this page is a hardcoded
 * fixture — no `api.*` call, no domain logic, nothing here is a T13R3
 * dashboard. Reachable only by direct URL (`/dev/style-gallery`); it is
 * deliberately NOT in `NAV_ITEMS`, so it is not a nav destination and
 * carries no dead-link risk. Used to keyboard/touch/contrast/zoom-walk
 * every shared primitive and state family in one place for T13R2 Worker
 * Verification. */
export default function StyleGallery() {
  const [chipPressed, setChipPressed] = useState<Record<string, boolean>>({ fire: true });
  const [panelOpen, setPanelOpen] = useState(false);

  const toggleChip = (key: string) => setChipPressed((s) => ({ ...s, [key]: !s[key] }));

  return (
    <section>
      <PageHeader
        title="Style Gallery (T13R2 verification fixture)"
        subtitle="Every shared shell primitive and state family, with fixture data only."
      />

      <div className="card-grid">
        <div className="card">
          {/* T13C2 REWORK verification: a header action button must stay
             readable — this exact shape (plain <button> inside
             .card-header-actions) is what was invisible before the fix. */}
          <div className="card-header">
            Card with header
            <div className="card-header-actions">
              <button type="button">Header action</button>
            </div>
          </div>
          <p>Cards use `--surface-card`, `--radius-md`, and `--elevation-1`.</p>
        </div>
        <div className="card">
          {/* T13C2 verification fixture addition: identity-hero + quick-action
             + roster-kind-badge primitives, fixture data only (no api.* call),
             same rationale as the rest of this page. */}
          <div className="card-header">Identity hero</div>
          <div className="identity-hero">
            <Avatar label="Alex Rowan" />
            <div>
              <p className="identity-hero-name">Alex Rowan</p>
              <p className="identity-hero-rank">Rookie Tamer</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            Roster kinds
            <div className="card-header-actions">
              <span className="roster-kind-badge" data-kind="COMBAT">
                COMBAT
              </span>
              <span className="roster-kind-badge" data-kind="COMPANY">
                COMPANY
              </span>
              <span className="roster-kind-badge" data-kind="MOUNT">
                MOUNT
              </span>
            </div>
          </div>
          <p>Derived from `RosterRecord.rules` flags — never a new field.</p>
        </div>
        <div className="card">
          <div className="card-header">Chips</div>
          <div className="button-row" role="group" aria-label="Type filter chips">
            {["fire", "water", "grass"].map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={!!chipPressed[t]}
                onClick={() => toggleChip(t)}
              >
                {t}
              </button>
            ))}
            <button type="button" className="chip" disabled>
              disabled
            </button>
          </div>
        </div>
      </div>

      <h2>Badges (type / item / stat / move category)</h2>
      <div className="button-row" style={{ marginBottom: "1em" }}>
        <TypeBadge type="fire" />
        <TypeBadge type="water" />
        <TypeBadge type="electric" />
        <ItemCategoryBadge category="medicine" />
        <ItemCategoryBadge category="pokeball" />
        <StatBadge stat="special_attack" value={3} />
        <MoveCategoryBadge category="Physical" />
      </div>

      <h2>Quick actions</h2>
      <div className="quick-actions-grid" style={{ marginBottom: "1em" }}>
        <span className="quick-action quick-action-roster">
          <IconRoster /> Open Roster
        </span>
        <span className="quick-action quick-action-add">
          <IconCreatures /> Add Creature
        </span>
        <span className="quick-action quick-action-items">
          <IconBag /> View Items
        </span>
        <span className="quick-action quick-action-shop">
          <IconShop /> Shop
        </span>
      </div>

      <h2>HP bars (ok / warning / danger / fainted)</h2>
      <div className="card-grid" style={{ marginBottom: "1em" }}>
        <HpBar current={56} max={56} />
        <HpBar current={20} max={56} />
        <HpBar current={8} max={56} />
        <HpBar current={0} max={56} />
      </div>

      <h2>Stat allocation row (T13C1/T13C2 guided allocation panel)</h2>
      <div className="card" style={{ marginBottom: "1em" }}>
        <div className="stat-allocation-rows">
          {[
            { label: "HP", color: "var(--stat-hp-base)", floor: 10, points: 4, resolved: 14 },
            { label: "Attack", color: "var(--stat-atk-base)", floor: 5, points: 2, resolved: 7 },
            { label: "Speed", color: "var(--stat-speed-base)", floor: 5, points: 0, resolved: 5 },
          ].map((row) => (
            <div className="stat-allocation-row" key={row.label}>
              <span className="stat-allocation-dot" style={{ background: row.color }} aria-hidden="true" />
              <span className="stat-allocation-label">{row.label}</span>
              <span className="stat-allocation-floor">Floor {row.floor}</span>
              <button type="button" aria-label={`Decrease ${row.label}`} disabled={row.points <= 0}>
                −
              </button>
              <input aria-label={`${row.label} points`} type="number" readOnly value={row.points} />
              <button type="button" aria-label={`Increase ${row.label}`}>
                +
              </button>
              <span className="stat-allocation-resolved">= {row.resolved}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>List rows (definition-card pattern)</h2>
      <ul className="definition-card-list" style={{ listStyle: "none", padding: 0 }}>
        {["Shadow Claw", "Astonish", "Hex"].map((name) => (
          <li key={name} className="definition-card">
            <span className="definition-card-name">{name}</span>
            <span className="definition-card-badges">
              <TypeBadge type="ghost" />
            </span>
          </li>
        ))}
      </ul>

      <h2>Action hierarchy</h2>
      <div className="button-row" style={{ marginBottom: "1em" }}>
        <button type="button" className="btn-primary">
          Primary
        </button>
        <button type="button">Secondary</button>
        <button type="button" className="btn-danger">
          Danger
        </button>
        <button type="button" disabled>
          Disabled
        </button>
      </div>

      <h2>Drawer / bottom sheet (AdaptivePanel)</h2>
      <button type="button" onClick={() => setPanelOpen(true)}>
        Open panel
      </button>
      <AdaptivePanel open={panelOpen} onClose={() => setPanelOpen(false)} title="Example panel">
        <p>Centered popover on wide viewports, bottom sheet at ≤640px — same component, no duplication.</p>
      </AdaptivePanel>

      <h2>Callouts</h2>
      <p className="callout-info" role="status">
        Info callout.
      </p>
      <p className="callout-warning" role="status">
        <IconWarning /> Warning callout — icon + text, never color alone.
      </p>
      <p className="callout-danger" role="alert">
        Danger callout.
      </p>

      <h2>Validation panel</h2>
      <div className="validation-panel">
        <h3>Validation</h3>
        <p className="callout-info" role="status">
          Passed: 8 checks.
        </p>
        <p className="callout-warning" role="status">
          <IconWarning /> Warning: contest type is set to Cool.
        </p>
        <p className="callout-danger" role="alert">
          Error: effect text is empty.
        </p>
      </div>

      <h2>Loading / skeleton</h2>
      <Loading label="Loading…" />
      <SkeletonLines lines={3} label="Loading fixture rows…" />

      <h2>Empty / error</h2>
      <Empty>Nothing here yet — fixture empty state.</Empty>
      <ErrorState error="Fixture error message." onRetry={() => {}} />
    </section>
  );
}
