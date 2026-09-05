import { SheetTabs } from "../components/SheetTabs";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";
import { IconChevronLeft } from "../components/icons";
import { useAppStore } from "../store/appStore";
import { OverviewTab } from "./trainer-sheet/OverviewTab";
import { PokemonTab } from "./trainer-sheet/PokemonTab";
import { CombatTab } from "./trainer-sheet/CombatTab";
import { InventoryTab } from "./trainer-sheet/InventoryTab";

type Tab = "overview" | "pokemon" | "combat" | "inventory";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Sheet" },
  { key: "pokemon", label: "Pokémon & Rosters" },
  { key: "combat", label: "Combat" },
  { key: "inventory", label: "Inventory & Shop" },
];

/** Trainer sheet: everything trainer-scoped lives here as tabs (spec §19:
 * "tabs for dense sheets") rather than separate routes, since these flows
 * all operate on the same loaded profile. */
export default function TrainerSheet() {
  const { trainerId } = useParams<{ trainerId: string }>();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const setActiveTrainerId = useAppStore((s) => s.setActiveTrainerId);
  // T13C1: TrainerList sets this after creating a Trainer, so the guided
  // Stat Point allocation panel is reachable right on arrival — read once
  // on mount only, never re-derived from a later navigation state.
  const [openAllocationOnMount] = useState(
    () => Boolean((location.state as { openAllocation?: boolean } | null)?.openAllocation),
  );

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => api.loadTrainer(trainerId!),
    enabled: !!trainerId,
  });

  // T13R1_DESIGN_CONTRACT.md §10.1: opening a Trainer makes them "the
  // active Trainer" — Home/Rosters/Pokédex-add-flow all key off this so
  // they don't require re-navigating through /trainer every time.
  useEffect(() => {
    if (trainerId) setActiveTrainerId(trainerId);
  }, [trainerId, setActiveTrainerId]);

  if (!trainerId) return <ErrorState error="No trainer id in URL." />;
  if (trainerQuery.isLoading) return <Loading label="Loading trainer…" />;
  if (trainerQuery.isError) return <ErrorState error={trainerQuery.error} onRetry={() => trainerQuery.refetch()} />;
  if (!trainerQuery.data) return <Empty>Trainer not found.</Empty>;

  const profile = trainerQuery.data;
  const refetch = () => trainerQuery.refetch();

  return (
    <section>
      <Link to="/trainer" className="breadcrumb-back">
        <IconChevronLeft /> All Trainers
      </Link>
      <div className="button-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Trainer Sheet</h1>
        <ExportTrainerButton trainerId={profile.id} trainerName={profile.name} />
      </div>
      <SheetTabs tabs={TABS} value={tab} onChange={key => setTab(key as Tab)} label="Trainer sheet sections">
        {tab === "overview" && (
          <OverviewTab profile={profile} refetch={refetch} openAllocationOnMount={openAllocationOnMount} />
        )}
        {tab === "pokemon" && <PokemonTab profile={profile} refetch={refetch} />}
        {tab === "combat" && <CombatTab profile={profile} refetch={refetch} />}
        {tab === "inventory" && <InventoryTab profile={profile} refetch={refetch} />}
      </SheetTabs>
    </section>
  );
}

/** Flow 12: export the Trainer (and referenced homebrew) to a `.ptutrainer` file. */
function ExportTrainerButton({ trainerId, trainerName }: { trainerId: string; trainerName: string }) {
  const exportTrainer = useMutation({
    mutationFn: async () => {
      const path = await save({
        defaultPath: `${trainerName}.ptutrainer`,
        filters: [{ name: "PTU Trainer Pack", extensions: ["ptutrainer"] }],
      });
      if (!path) return null;
      return api.exportTrainerPack(trainerId, path);
    },
  });

  return (
    <div>
      <button type="button" onClick={() => exportTrainer.mutate()} disabled={exportTrainer.isPending}>
        Export Trainer…
      </button>
      {exportTrainer.isError && <ErrorState error={exportTrainer.error} />}
      {exportTrainer.isSuccess && exportTrainer.data && (
        <p role="status" className="callout-info">
          Exported, embedding {exportTrainer.data.length} referenced homebrew pack(s).
        </p>
      )}
    </div>
  );
}
