import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DefinitionDetail } from "../DefinitionDetail";
import { ResolvedDefinition } from "../../lib/api";

function resolved(data: Record<string, unknown>, overrides: Partial<ResolvedDefinition> = {}): ResolvedDefinition {
  return {
    definition_version_id: "moves:test@core",
    logical_id: "test",
    content_pack_id: "ptu-core-1.05",
    name: "Test Entry",
    needs_review: false,
    data_json: JSON.stringify(data),
    reason: "priority",
    ...overrides,
  };
}

describe("DefinitionDetail", () => {
  it("never renders raw JSON (restart plan: no raw IDs/JSON visible to the user)", () => {
    render(
      <DefinitionDetail
        resolved={resolved(
          {
            type: "Grass",
            class: "Special",
            ac_text: "2",
            frequency_text: "At-Will",
            range_text: "4, 1 Target",
            damage_base: 2,
            damage_dice: "1d6+3",
            effect_text: "After the target takes damage, the user gains Hit Points.",
            contest_type: "Smart",
            contest_effect: "Good Show!",
            raw_text: "Move: Absorb\nType: Grass",
          },
          { name: "Absorb" },
        )}
      />,
    );
    expect(document.querySelector(".detail-json")).not.toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("renders a move's key facts and effect text", () => {
    render(
      <DefinitionDetail
        resolved={resolved({
          type: "Grass",
          class: "Special",
          ac_text: "2",
          frequency_text: "At-Will",
          range_text: "4, 1 Target",
          damage_base: 2,
          damage_dice: "1d6+3",
          effect_text: "After the target takes damage, the user gains Hit Points.",
        })}
      />,
    );
    expect(screen.getByTestId("type-badge")).toHaveTextContent("Grass");
    expect(screen.getByTestId("move-category-badge")).toHaveTextContent("Special");
    expect(screen.getByText("At-Will")).toBeInTheDocument();
    expect(screen.getByText("DB 2 (1d6+3)")).toBeInTheDocument();
    expect(screen.getByText("After the target takes damage, the user gains Hit Points.")).toBeInTheDocument();
  });

  it("shows a visible data-gap callout for an incomplete species instead of hiding it", () => {
    render(
      <DefinitionDetail
        resolved={resolved({
          types: ["Fighting", "Ghost"],
          base_stats: {},
          mechanical_completeness: "external_stub",
          missing_mechanical_fields: ["base_stats", "ability_slots"],
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/missing source data for: base_stats, ability_slots/);
  });

  it("shows a review callout when needs_review is true", () => {
    render(<DefinitionDetail resolved={resolved({ effect_text: "x" }, { needs_review: true })} />);
    expect(screen.getByText(/flagged for review/)).toBeInTheDocument();
  });

  it("renders a generic edge's prerequisites/effect via the shared secondary-field list", () => {
    render(
      <DefinitionDetail
        resolved={resolved({
          prerequisites_text: "Prerequisites: Novice Acrobatics",
          effect_text: "Increase your Jump Capability by +1.",
        })}
      />,
    );
    expect(screen.getByText("Prerequisites: Novice Acrobatics")).toBeInTheDocument();
    expect(screen.getByText("Increase your Jump Capability by +1.")).toBeInTheDocument();
  });

  it("always shows the source text as readable prose so nothing is lost to the generic layout", () => {
    render(<DefinitionDetail resolved={resolved({ raw_text: "Original extracted rule text." })} />);
    expect(screen.getByText("Original extracted rule text.")).toBeInTheDocument();
  });
});
