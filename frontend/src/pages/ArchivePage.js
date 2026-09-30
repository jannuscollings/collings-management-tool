import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { RotateCcw } from "lucide-react";

import { workApi } from "../api/work";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { useWorkItemContext } from "../components/work/WorkItemDrawer";

const empty = { workspaces: [], boards: [], work_items: [] };

export default function ArchivePage() {
  const isAdmin = useSelector((state) => Boolean(state.auth.user?.is_staff));
  const { refreshWorkspaces } = useWorkItemContext();
  const [records, setRecords] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try { setRecords((await workApi.listArchive()).data); }
    catch { setError(true); toast.error("Couldn't load the archive"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const restore = async (key, operation) => {
    setBusy(key);
    try {
      await operation();
      await load();
      refreshWorkspaces?.();
      toast.success("Restored");
    } catch (error) { toast.error(error.response?.data?.detail || "Couldn't restore this record"); }
    finally { setBusy(null); }
  };

  if (!isAdmin) return <Navigate to="/home" replace />;
  const section = (title, entries, identity, context, operation) => <section className="space-y-3">
    <h2 className="text-sm font-extrabold text-ink">{title}</h2>
    {entries.length ? entries.map((entry) => <Panel key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="break-words text-sm font-bold text-ink">{identity(entry)}</p>
        <p className="mt-1 break-words text-xs text-muted">{context(entry)}</p>
      </div>
      <Button variant="secondary" disabled={Boolean(busy)} onClick={() => restore(`${title}:${entry.id}`, () => operation(entry))}>
        <RotateCcw className="h-4 w-4" />{busy === `${title}:${entry.id}` ? "Restoring…" : "Restore"}
      </Button>
    </Panel>) : <Panel className="border-dashed p-4 text-sm text-muted">None archived.</Panel>}
  </section>;

  return <PageContainer className="space-y-7 pb-16 shell:pb-[34px]">
    <PageHeader eyebrow="Admin" title="Archive" description="Restore workspaces, boards and work items when they are needed again." />
    {loading ? <p role="status" className="text-sm text-muted">Loading archive…</p> : <>
      {error && <Panel className="p-4"><p role="alert" className="text-sm text-critical">Couldn't load the archive.</p><Button className="mt-3" variant="secondary" onClick={load}>Retry</Button></Panel>}
      {!error && <>
      {section("Archived Workspaces", records.workspaces, (row) => row.name, (row) => `/${row.slug}`,
        (row) => workApi.restoreWorkspace(row.slug))}
      {section("Archived Boards", records.boards, (row) => row.name,
        (row) => `${row.workspace__name}${row.workspace__archived ? " · Workspace archived" : ""}`,
        (row) => workApi.restoreBoard(row.workspace__slug, row.id))}
      {section("Archived Work Items", records.work_items, (row) => `${row.reference} · ${row.title}`,
        (row) => `${row.group__workspace__name} / ${row.group__name}${row.group__archived || row.group__workspace__archived ? " · Parent archived" : ""}`,
        (row) => workApi.restoreItem(row.id))}
      </>}
    </>}
  </PageContainer>;
}
