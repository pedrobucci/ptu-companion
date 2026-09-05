import { useState, type ReactElement } from "react";
import { HashRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import TrainerList from "./pages/TrainerList";
import TrainerSheet from "./pages/TrainerSheet";
import CreatureSheet from "./pages/CreatureSheet";
import Pokedex from "./pages/Pokedex";
import Rosters from "./pages/Rosters";
import Editor from "./pages/Editor";
import Settings from "./pages/Settings";
import ComingSoon from "./pages/ComingSoon";
import StyleGallery from "./pages/dev/StyleGallery";
import { AdaptivePanel } from "./components/AdaptivePanel";
import {
  IconBag,
  IconCreatures,
  IconHome,
  IconJournal,
  IconMore,
  IconRoster,
  IconSearch,
  IconSettings,
  IconStorage,
  IconShop,
  IconUser,
  IconWrench,
  type IconProps,
} from "./components/icons";
import "./App.css";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  Icon: (props: IconProps) => ReactElement;
  /** Shown in the Android bottom bar (max 4 + the "More" trigger itself,
   * per T13R1_DESIGN_CONTRACT.md §6/§7 — "Home, Creatures, Rosters, Items,
   * and More"). Everything else moves into the "More" sheet on narrow
   * viewports but stays in the full desktop sidebar unconditionally. */
  mobilePrimary?: boolean;
  /** Informational only (T13R1 §7 divergence: Editor works identically on
   * every viewport today — there is no real Android-restricted capability
   * yet, so this is a label, not a disabled/blocked state). */
  note?: string;
}

/** Single source of truth for both the desktop sidebar and the Android
 * bottom bar + More sheet (T13_INTERACTION_PATTERNS.md pattern 7: "add one
 * entry here; both layouts pick it up automatically"). Order matches the
 * nav destination table in T13R1_DESIGN_CONTRACT.md §7. Battle Log, Quests,
 * and a notification bell are deliberately absent — no approved behavior
 * backs them (contract §3/§7). */
const NAV_ITEMS: NavItem[] = [
  { to: "/", end: true, label: "Home", Icon: IconHome, mobilePrimary: true },
  { to: "/trainer", label: "Trainers", Icon: IconUser },
  { to: "/pokedex", label: "Creatures", Icon: IconCreatures, mobilePrimary: true },
  { to: "/rosters", label: "Rosters", Icon: IconRoster, mobilePrimary: true },
  { to: "/items", label: "Items", Icon: IconBag, mobilePrimary: true },
  { to: "/storage", label: "Storage", Icon: IconStorage },
  { to: "/shop", label: "Shop", Icon: IconShop },
  { to: "/npc-journal", label: "NPC Journal", Icon: IconJournal },
  { to: "/editor", label: "Editor", Icon: IconWrench, note: "Windows" },
  { to: "/settings", label: "Settings", Icon: IconSettings },
];

const MOBILE_PRIMARY = NAV_ITEMS.filter((i) => i.mobilePrimary);
const MOBILE_MORE = NAV_ITEMS.filter((i) => !i.mobilePrimary);

function NavLinkItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { to, end, label, Icon, note } = item;
  return (
    <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={onNavigate}>
      <Icon className="nav-link-icon" />
      <span className="nav-link-label">
        {label}
        {note && <span className="nav-link-note"> ({note})</span>}
      </span>
    </NavLink>
  );
}

/** Android "More" sheet: reuses AdaptivePanel (bottom sheet at ≤640px)
 * rather than a bespoke drawer implementation — one modal/bottom-sheet
 * primitive for the whole app (T13R1 §5). */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="nav-link nav-link-more" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconMore className="nav-link-icon" />
        <span className="nav-link-label">More</span>
      </button>
      <AdaptivePanel open={open} onClose={() => setOpen(false)} title="More">
        <nav aria-label="More destinations" className="more-menu-list">
          {MOBILE_MORE.map((item) => (
            <NavLinkItem key={item.to} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
      </AdaptivePanel>
    </>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-brand-mark" aria-hidden="true"><span /></span>
        <span>PTU Companion<small className="brand-caption">YOUR TABLETOP FIELD GUIDE</small></span>
      </div>
      <Link to="/pokedex" className="app-header-search" aria-label="Search Creatures">
        <IconSearch />
        <span className="app-header-search-label">Search</span>
      </Link>
    </header>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
        <AppHeader />
        <div className="app-body">
          <nav className="app-nav app-nav-desktop" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLinkItem key={item.to} item={item} />
            ))}
          </nav>
          <nav className="app-nav app-nav-mobile" aria-label="Main navigation">
            {MOBILE_PRIMARY.map((item) => (
              <NavLinkItem key={item.to} item={item} />
            ))}
            <MoreMenu />
          </nav>
          <main id="main-content" className="app-content" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/trainer" element={<TrainerList />} />
              <Route path="/trainer/:trainerId" element={<TrainerSheet />} />
              <Route path="/trainer/:trainerId/pokemon/:pokemonId" element={<CreatureSheet />} />
              <Route path="/pokedex" element={<Pokedex />} />
              <Route path="/rosters" element={<Rosters />} />
              <Route
                path="/items"
                element={
                  <ComingSoon
                    title="Items"
                    description="A dedicated Items view is coming soon. For now, manage your backpack from a Trainer's Inventory tab."
                  />
                }
              />
              <Route
                path="/storage"
                element={
                  <ComingSoon title="Storage" description="Pokémon and item storage management is coming soon." />
                }
              />
              <Route
                path="/shop"
                element={
                  <ComingSoon
                    title="Shop"
                    description="A full shop and checkout experience is coming soon. For now, a starter shop is available from a Trainer's Inventory tab."
                  />
                }
              />
              <Route
                path="/npc-journal"
                element={<ComingSoon title="NPC Journal" description="NPC notes and journal tracking are coming soon." />}
              />
              <Route path="/editor" element={<Editor />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dev/style-gallery" element={<StyleGallery />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
