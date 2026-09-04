import { create } from "zustand";

/** Ephemeral UI state only (spec 3.2) — persisted state always lives in
 * SQLite via the domain layer, never here. */
interface AppState {
  activeTrainerId: string | null;
  setActiveTrainerId: (id: string | null) => void;
  /** Content pack the active ruleset resolves against for engine calls
   * (damage chart, progression datasets). Fixed to Core for v1 — see the
   * Settings page and the T08 Worker Result for why ruleset switching UI
   * isn't built yet. */
  activeContentPackId: string;
}

export const useAppStore = create<AppState>((set) => ({
  activeTrainerId: null,
  setActiveTrainerId: (id) => set({ activeTrainerId: id }),
  activeContentPackId: "ptu-core-1.05",
}));
