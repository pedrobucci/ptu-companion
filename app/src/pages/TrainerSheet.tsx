import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";
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
  const [tab, setTab] = useState<Tab>("overview");

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => api.loadTrainer(trainerId!),
    enabled: !!trainerId,
  });

  if (!trainerId) return <ErrorState error="No trainer id in URL." />;
  if (trainerQuery.isLoading) return <Loading label="Loading trainer…" />;
  if (trainerQuery.isError) return <ErrorState error={trainerQuery.error} onRetry={() => trainerQuery.refetch()} />;
  if (!trainerQuery.data) return <Empty>Trainer not found.</Empty>;

  const profile = trainerQuery.data;
  const refetch = () => trainerQuery.refetch();

  return (
    <section>
      <div className="button-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>{profile.name}</h1>
        <ExportTrainerButton trainerId={profile.id} trainerName={profile.name} />
      </div>
      <div role="tablist" aria-label="Trainer sheet sections" className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "tab-button tab-button-active" : "tab-button"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "overview" && <OverviewTab profile={profile} refetch={refetch} />}
        {tab === "pokemon" && <PokemonTab profile={profile} refetch={refetch} />}
        {tab === "combat" && <CombatTab profile={profile} refetch={refetch} />}
        {tab === "inventory" && <InventoryTab profile={profile} refetch={refetch} />}
      </div>
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
        Export .ptutrainer…
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
