import { useMutation, useQuery } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";

/** Read-only for v1: shows the active Campaign Ruleset and imported
 * content packs. Ruleset switching/GM authoring UI is a disclosed gap —
 * see the T08 Worker Result. Full-backup export/import (spec §22.3) lives
 * here. */
export default function Settings() {
  const rulesetQuery = useQuery({ queryKey: ["ruleset-name"], queryFn: api.activeRulesetName });
  const packsQuery = useQuery({ queryKey: ["content-packs"], queryFn: api.listContentPacks });

  const exportBackup = useMutation({
    mutationFn: async () => {
      const path = await save({ defaultPath: "ptu-companion.ptubackup", filters: [{ name: "PTU Backup", extensions: ["ptubackup"] }] });
      if (!path) return;
      await api.exportBackup(path);
    },
  });

  const importBackup = useMutation({
    mutationFn: async () => {
      const path = await open({ filters: [{ name: "PTU Backup", extensions: ["ptubackup"] }] });
      if (!path || Array.isArray(path)) return;
      await api.importBackup(path);
    },
    onSuccess: () => {
      packsQuery.refetch();
    },
  });

  return (
    <section>
      <h1>Settings</h1>

      <h2>Active Ruleset</h2>
      {rulesetQuery.isLoading && <Loading />}
      {rulesetQuery.isError && <ErrorState error={rulesetQuery.error} />}
      {rulesetQuery.data && <p>{rulesetQuery.data}</p>}

      <h2>Full Backup</h2>
      <div className="button-row">
        <button type="button" onClick={() => exportBackup.mutate()} disabled={exportBackup.isPending}>
          Export .ptubackup…
        </button>
        <button type="button" onClick={() => importBackup.mutate()} disabled={importBackup.isPending}>
          Import .ptubackup…
        </button>
      </div>
      {exportBackup.isError && <ErrorState error={exportBackup.error} />}
      {exportBackup.isSuccess && <p role="status" className="callout-info">Backup exported.</p>}
      {importBackup.isError && <ErrorState error={importBackup.error} />}
      {importBackup.isSuccess && <p role="status" className="callout-info">Backup restored.</p>}

      <h2>Imported Content Packs</h2>
      {packsQuery.isLoading && <Loading label="Loading content packs…" />}
      {packsQuery.isError && <ErrorState error={packsQuery.error} onRetry={() => packsQuery.refetch()} />}
      {packsQuery.data && packsQuery.data.length === 0 && (
        <Empty>No content packs imported yet — restart the app to trigger the first-run bootstrap import.</Empty>
      )}
      {packsQuery.data && packsQuery.data.length > 0 && (
        <table className="pack-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Priority</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {packsQuery.data.map((pack) => (
              <tr key={pack.id}>
                <td>{pack.name}</td>
                <td>{pack.version}</td>
                <td>{pack.priority}</td>
                <td>{pack.kind ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
