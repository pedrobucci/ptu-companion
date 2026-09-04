import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoveCategoryBadge, TypeBadge } from "../TypeBadge";
import { ItemCategoryBadge } from "../ItemCategoryBadge";
import { StatBadge } from "../StatBadge";
import { TYPES } from "../../lib/pokemonPalette";

describe("TypeBadge", () => {
  it("maps every known type to its own data-type token", () => {
    for (const key of Object.keys(TYPES)) {
      const { unmount } = render(<TypeBadge type={key} />);
      expect(screen.getByTestId("type-badge")).toHaveAttribute("data-type", key);
      unmount();
    }
  });

  it("falls back to normal for an unknown/homebrew type instead of rendering unstyled", () => {
    render(<TypeBadge type="totally-made-up" />);
    expect(screen.getByTestId("type-badge")).toHaveAttribute("data-type", "normal");
  });

  it("dual-type renders two badges with distinct background colors", () => {
    render(
      <>
        <TypeBadge type="water" />
        <TypeBadge type="flying" />
      </>,
    );
    const [a, b] = screen.getAllByTestId("type-badge");
    expect(a.style.getPropertyValue("--badge-bg")).not.toBe(b.style.getPropertyValue("--badge-bg"));
  });
});

describe("MoveCategoryBadge", () => {
  it.each(["Physical", "Special", "Status"])("renders %s with its own category token", (category) => {
    render(<MoveCategoryBadge category={category} />);
    expect(screen.getByTestId("move-category-badge")).toHaveAttribute("data-category", category.toLowerCase());
  });
});

describe("ItemCategoryBadge", () => {
  it("resolves a loose label like 'Poké Balls' to the canonical pokeball token", () => {
    render(<ItemCategoryBadge category="Poké Balls" />);
    expect(screen.getByTestId("item-category-badge")).toHaveAttribute("data-category", "pokeball");
  });

  it("falls back to general for an unrecognized category", () => {
    render(<ItemCategoryBadge category="mystery-crate" />);
    expect(screen.getByTestId("item-category-badge")).toHaveAttribute("data-category", "general");
  });
});

describe("StatBadge", () => {
  it("shows the stat's abbreviated label and value together (never color alone)", () => {
    render(<StatBadge stat="special_attack" value={3} />);
    expect(screen.getByText("SpAtk 3")).toBeInTheDocument();
  });
});
