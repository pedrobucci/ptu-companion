import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "#/";
});

/** T13R2 shell verification (T13R1_DESIGN_CONTRACT.md §5-§7): a single
 * data-driven NAV_ITEMS list feeds both the full desktop sidebar and the
 * narrower Android bottom bar + More sheet, and no dead/unbacked
 * destination (Battle Log, Quests, a notification bell) is ever rendered.
 * `vitest.config.ts` sets `css: false`, so this only asserts DOM structure/
 * roles/labels/counts — never CSS-driven visibility (jsdom doesn't
 * evaluate `@media` layout anyway; the responsive behavior itself is a
 * visual-viewport check, done separately per Worker Verification). */
describe("App shell navigation", () => {
  it("desktop sidebar exposes the full, real destination set — no dead links", () => {
    const { container } = renderApp();
    const desktopNav = container.querySelector(".app-nav-desktop") as HTMLElement;
    expect(desktopNav).toBeTruthy();
    const labels = within(desktopNav)
      .getAllByRole("link")
      .map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      "Home",
      "Trainers",
      "Creatures",
      "Rosters",
      "Items",
      "Storage",
      "Shop",
      "NPC Journal",
      "Editor (Windows)",
      "Settings",
    ]);
  });

  it("never renders Battle Log, Quests, or a notification bell anywhere in the shell", () => {
    const { container } = renderApp();
    expect(screen.queryByText(/battle log/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/quests?/i)).not.toBeInTheDocument();
    // No unread-count badge element anywhere in the header/nav chrome.
    expect(container.querySelector("header")?.textContent).not.toMatch(/\d/);
  });

  it("mobile bottom bar shows exactly the 4 primary destinations plus a labeled More trigger", () => {
    const { container } = renderApp();
    const mobileNav = container.querySelector(".app-nav-mobile") as HTMLElement;
    const links = within(mobileNav)
      .getAllByRole("link")
      .map((el) => el.textContent?.trim());
    expect(links).toEqual(["Home", "Creatures", "Rosters", "Items"]);
    expect(within(mobileNav).getByRole("button", { name: /more/i })).toBeInTheDocument();
  });

  it("More opens a dialog listing every remaining destination, reachable and closeable by keyboard", async () => {
    const { container } = renderApp();
    const user = userEvent.setup();
    const mobileNav = container.querySelector(".app-nav-mobile") as HTMLElement;
    const moreButton = within(mobileNav).getByRole("button", { name: /more/i });

    // Keyboard-only open: Tab to the button, Enter to activate — never a
    // pointer-only interaction (plan constraint).
    moreButton.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "More" });
    const moreLinks = within(dialog)
      .getAllByRole("link")
      .map((el) => el.textContent?.trim());
    expect(moreLinks).toEqual(["Trainers", "Storage", "Shop", "NPC Journal", "Editor (Windows)", "Settings"]);

    // Keyboard-only close via the explicit Close control (AdaptivePanel's
    // native Escape-to-cancel is real <dialog> platform behavior that
    // jsdom's dialog polyfill in this suite doesn't simulate — verified
    // manually instead, see the T13R2 Worker Result).
    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    closeButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog", { name: "More" })).not.toBeInTheDocument();
  });

  it("the active route is marked with aria-current for assistive tech, not color alone", () => {
    const { container } = renderApp();
    const homeLink = within(container.querySelector(".app-nav-desktop") as HTMLElement).getByRole("link", {
      name: "Home",
    });
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("every new shell route (Rosters/Items/Storage/Shop/NPC Journal) renders a real page, not a 404", async () => {
    for (const [hash, heading] of [
      ["#/rosters", "Rosters"],
      ["#/items", "Items"],
      ["#/storage", "Storage"],
      ["#/shop", "Shop"],
      ["#/npc-journal", "NPC Journal"],
    ] as const) {
      window.location.hash = hash;
      const { unmount } = renderApp();
      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      unmount();
    }
  });
});
