import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolvedStat } from "../ResolvedStat";

describe("resolved source disclosure", () => {
  it("preserves the supplied result and source entries in a named closeable dialog", async () => {
    const user = userEvent.setup();
    render(<ResolvedStat label="Max HP" value={{base:40,final_value:42,breakdown:[{label:"Test source",operation:"add",value:2,resulting_value:42}]}} />);
    const trigger = screen.getByRole("button",{name:/Max HP/});
    expect(trigger).toHaveTextContent("42");
    await user.click(trigger);
    const dialog = screen.getByRole("dialog",{name:"Max HP — sources"});
    expect(within(dialog).getByText("Base 40")).toBeVisible();
    expect(within(dialog).getByText("Test source: add 2 → 42")).toBeVisible();
    await user.click(within(dialog).getByRole("button",{name:"Close"}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded","false");
    expect(trigger).toHaveTextContent("42");
  });
  it("does not offer an empty explanation", () => {
    render(<ResolvedStat label="Speed" value={{base:5,final_value:5,breakdown:[]}} />);
    expect(screen.getByRole("button",{name:/Speed/})).toBeDisabled();
  });
});
