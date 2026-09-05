import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import TrainerList from "../TrainerList";
import { api, TrainerProfile } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, api: { ...actual.api, listTrainers: vi.fn(), createTrainer: vi.fn() } };
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="nav-state">{JSON.stringify(location.state)}</p>;
}

/** T13C1 AC: the guided Stat Point allocation panel must be reachable
 * right after Trainer creation — this is how `TrainerSheet`/`OverviewTab`
 * learn to auto-open it, so a regression here would silently break that
 * entry point. */
describe("TrainerList — T13C1 post-creation allocation entry point", () => {
  it("navigates to the new Trainer with an openAllocation navigation flag", async () => {
    vi.mocked(api.listTrainers).mockResolvedValue([]);
    const profile: TrainerProfile = { id: "new-t1", name: "Ash", level: 1 } as TrainerProfile;
    vi.mocked(api.createTrainer).mockResolvedValue(profile);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/trainer"]}>
          <Routes>
            <Route path="/trainer" element={<TrainerList />} />
            <Route path="/trainer/:trainerId" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New Trainer name"), "Ash");
    await user.click(screen.getByRole("button", { name: "Create Trainer" }));

    expect(await screen.findByTestId("nav-state")).toHaveTextContent(JSON.stringify({ openAllocation: true }));
  });
});
