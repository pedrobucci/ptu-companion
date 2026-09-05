import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";

/** Flow 1 (spec §32): create/load one active Trainer. Only lightweight
 * summaries are listed here — opening one is what hydrates its full state
 * (spec §26), so this list never touches Pokémon/rosters/inventory data. */
export default function TrainerList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: api.listTrainers,
  });

  const createTrainer = useMutation({
    mutationFn: (name: string) => api.createTrainer(name),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      // T13C1: opens the guided Stat Point allocation panel immediately —
      // the T13 UX GATE's finding was that attributes couldn't be filled
      // right after creation.
      navigate(`/trainer/${profile.id}`, { state: { openAllocation: true } });
    },
  });

  const importTrainer = useMutation({
    mutationFn: async () => {
      const path = await open({ filters: [{ name: "PTU Trainer Pack", extensions: ["ptutrainer"] }] });
      if (!path || Array.isArray(path)) return null;
      return api.importTrainerPack(path);
    },
    onSuccess: (trainerId) => {
      if (!trainerId) return;
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      navigate(`/trainer/${trainerId}`);
    },
  });

  return (
    <section>
      <h1>Trainers</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createTrainer.mutate(newName.trim());
        }}
        className="inline-form"
      >
        <label htmlFor="new-trainer-name">New Trainer name</label>
        <input
          id="new-trainer-name"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          placeholder="e.g. Ash"
        />
        <button type="submit" disabled={createTrainer.isPending || !newName.trim()}>
          {createTrainer.isPending ? "Creating…" : "Create Trainer"}
        </button>
        <button type="button" onClick={() => importTrainer.mutate()} disabled={importTrainer.isPending}>
          Import .ptutrainer…
        </button>
      </form>
      {createTrainer.isError && <ErrorState error={createTrainer.error} />}
      {importTrainer.isError && <ErrorState error={importTrainer.error} />}

      {trainersQuery.isLoading && <Loading label="Loading trainers…" />}
      {trainersQuery.isError && <ErrorState error={trainersQuery.error} onRetry={() => trainersQuery.refetch()} />}
      {trainersQuery.data && trainersQuery.data.length === 0 && (
        <Empty>No trainers yet — create one above to get started.</Empty>
      )}
      {trainersQuery.data && trainersQuery.data.length > 0 && (
        <ul className="trainer-list">
          {trainersQuery.data.map((t) => (
            <li key={t.id}>
              <button type="button" className="trainer-list-item" onClick={() => navigate(`/trainer/${t.id}`)}>
                <span className="trainer-list-name">{t.name}</span>
                <span className="trainer-list-meta">
                  Lv {t.level} · ₽{t.money}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
