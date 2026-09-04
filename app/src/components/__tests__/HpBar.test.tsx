import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HpBar } from "../HpBar";

/** Threshold exactness per canvas note "pokemon-ui-design-compliance" §6:
 * >50% green, 20-50% warning, >0/<20% danger, 0% fainted — checked at the
 * exact boundary values (51/50/20/19/0) so an off-by-one in the ratio
 * comparison fails here instead of shipping. */
describe("HpBar threshold states", () => {
  it.each([
    [51, "ok"],
    [50, "warning"],
    [20, "warning"],
    [19, "danger"],
    [0, "fainted"],
  ] as const)("current=%i of 100 -> state=%s", (current, expected) => {
    render(<HpBar current={current} max={100} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(current));
    const fill = document.querySelector(".hp-bar-fill");
    expect(fill).toHaveAttribute("data-state", expected);
  });

  it("never signals state through color alone: the numeric label is always present", () => {
    render(<HpBar current={19} max={100} />);
    expect(screen.getByText("19 / 100")).toBeInTheDocument();
  });
});
