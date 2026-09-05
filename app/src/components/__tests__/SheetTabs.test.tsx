import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetTabs } from "../SheetTabs";

function Example() {
  const [tab, setTab] = useState("sheet");
  return <SheetTabs tabs={[{key:"sheet",label:"Sheet"},{key:"moves",label:"Moves"},{key:"history",label:"History"}]} value={tab} onChange={setTab} label="Sections">{tab}</SheetTabs>;
}
describe("sheet navigation", () => {
  it("keeps one tab stop, moves focus with arrows/Home/End, and names the active panel", async () => {
    const user = userEvent.setup(); render(<Example />);
    await user.tab(); expect(screen.getByRole("tab",{name:"Sheet"})).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab",{name:"History"})).toHaveFocus();
    expect(screen.getByRole("tabpanel",{name:"History"})).toHaveTextContent("history");
    await user.keyboard("{Home}{ArrowRight}");
    expect(screen.getByRole("tab",{name:"Moves"})).toHaveAttribute("aria-selected","true");
    expect(screen.getByRole("tab",{name:"Sheet"})).toHaveAttribute("tabindex","-1");
    await user.keyboard("{End}{Tab}"); expect(screen.getByRole("tabpanel",{name:"History"})).toHaveFocus();
  });
});
