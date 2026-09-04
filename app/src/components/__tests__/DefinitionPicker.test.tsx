import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DefinitionPicker } from "../DefinitionPicker";
import { api, SearchHit } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, api: { ...actual.api, searchContent: vi.fn() } };
});

const hits: SearchHit[] = [
  { kind: "move", definition_version_id: "moves:crunch@core", logical_id: "crunch", content_pack_id: "ptu-core-1.05", name: "Crunch" },
  { kind: "move", definition_version_id: "moves:cut@core", logical_id: "cut", content_pack_id: "ptu-core-1.05", name: "Cut" },
];

function renderPicker(onSelect = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DefinitionPicker kind="move" label="Moves" onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return onSelect;
}

describe("DefinitionPicker", () => {
  it("never asks for a raw definition id — the input is a name search", () => {
    renderPicker();
    expect(screen.queryByPlaceholderText(/moves:crunch@core/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("searches by name and lets the user click a result, passing the real hit (never a typed id)", async () => {
    vi.mocked(api.searchContent).mockResolvedValue(hits);
    const onSelect = renderPicker();
    const user = userEvent.setup();

    await user.type(screen.getByRole("combobox"), "cru");

    await waitFor(() => expect(screen.getByText("Crunch")).toBeInTheDocument());
    await user.click(screen.getByText("Crunch"));

    expect(onSelect).toHaveBeenCalledWith(hits[0]);
  });

  it("supports arrow-key navigation and Enter to select (keyboard accessibility)", async () => {
    vi.mocked(api.searchContent).mockResolvedValue(hits);
    const onSelect = renderPicker();
    const user = userEvent.setup();

    const input = screen.getByRole("combobox");
    await user.type(input, "c");
    await waitFor(() => expect(screen.getByText("Cut")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(hits[1]);
  });

  it("shows a plain no-matches message rather than an empty silent dropdown", async () => {
    vi.mocked(api.searchContent).mockResolvedValue([]);
    renderPicker();
    const user = userEvent.setup();

    await user.type(screen.getByRole("combobox"), "zzz");

    await waitFor(() => expect(screen.getByText(/No matches for "zzz"/)).toBeInTheDocument());
  });
});
