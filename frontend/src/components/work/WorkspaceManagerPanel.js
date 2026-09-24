import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Archive, ArrowDown, ArrowUp, RotateCcw } from "lucide-react";

import { workApi } from "../../api/work";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import Panel from "../ui/Panel";

export default function WorkspaceManagerPanel({ onChanged, onDirty, onBusy }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [names, setNames] = useState({});
  const [newWorkspace, setNewWorkspace] = useState({ name: "", initial_group_name: "" });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await workApi.listWorkspaces({ include_archived: true });
      setWorkspaces(data);
      setNames(Object.fromEntries(data.map((workspace) => [workspace.id, workspace.name])));
    } catch {
      toast.error("Couldn't load workspace management");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => (
    Boolean(newWorkspace.name || newWorkspace.initial_group_name)
    || workspaces.some((workspace) => names[workspace.id] !== workspace.name)
  ), [names, newWorkspace, workspaces]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onBusy(Boolean(busyId)); }, [busyId, onBusy]);

  const create = async (event) => {
    event.preventDefault();
    setBusyId("create");
    try {
      const { data } = await workApi.createWorkspace({
        name: newWorkspace.name.trim(),
        initial_group_name: newWorkspace.initial_group_name.trim(),
      });
      toast.success(`${data.name} created`);
      setNewWorkspace({ name: "", initial_group_name: "" });
      await load();
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.slug?.[0] || error.response?.data?.name?.[0] || "Couldn't create the workspace");
    } finally {
      setBusyId(null);
    }
  };

  const saveName = async (workspace) => {
    const name = names[workspace.id]?.trim();
    if (!name || name === workspace.name) return;
    setBusyId(workspace.id);
    try {
      await workApi.updateWorkspace(workspace.slug, { name });
      toast.success("Workspace renamed");
      await load();
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.name?.[0] || "Couldn't rename the workspace");
    } finally {
      setBusyId(null);
    }
  };

  const setArchived = async (workspace, archived) => {
    if (archived && !window.confirm(`Archive ${workspace.name}? Its work remains stored, but the workspace will leave normal navigation.`)) return;
    setBusyId(workspace.id);
    try {
      if (archived) await workApi.archiveWorkspace(workspace.slug);
      else await workApi.restoreWorkspace(workspace.slug);
      toast.success(archived ? "Workspace archived" : "Workspace restored");
      await load();
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Couldn't update the workspace");
    } finally {
      setBusyId(null);
    }
  };

  const move = async (workspace, direction) => {
    const active = workspaces.filter((candidate) => !candidate.archived);
    const index = active.findIndex((candidate) => candidate.id === workspace.id);
    const target = index + direction;
    if (target < 0 || target >= active.length) return;
    const reordered = [...active];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusyId("order");
    try {
      const { data } = await workApi.reorderWorkspaces(reordered.map((candidate) => candidate.id));
      setWorkspaces([...data, ...workspaces.filter((candidate) => candidate.archived)]);
      toast.success("Workspace order saved");
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.workspace_ids?.[0] || "Couldn't reorder workspaces");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && workspaces.length === 0) return <p className="text-sm text-muted">Loading workspaces…</p>;

  const active = workspaces.filter((workspace) => !workspace.archived);
  const archived = workspaces.filter((workspace) => workspace.archived);

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <h3 className="text-sm font-extrabold text-ink">Create workspace</h3>
        <p className="mt-1 text-xs text-muted">Start with one delivery group. More workspace structure can be added later.</p>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Workspace name">
            <Input required value={newWorkspace.name} onChange={(event) => setNewWorkspace((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="First group">
            <Input required value={newWorkspace.initial_group_name} onChange={(event) => setNewWorkspace((current) => ({ ...current, initial_group_name: event.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={Boolean(busyId)}>Create workspace</Button>
          </div>
        </form>
      </Panel>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-ink">Active workspaces</h3>
          <Badge variant="neutral">{active.length}</Badge>
        </div>
        <div className="space-y-3">
          {active.map((workspace, index) => (
            <Panel key={workspace.id} className="p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Field label="Name">
                  <Input value={names[workspace.id] || ""} onChange={(event) => setNames((current) => ({ ...current, [workspace.id]: event.target.value }))} />
                </Field>
                <div className="flex gap-1" aria-label={`Reorder ${workspace.name}`}>
                  <Button size="icon" variant="secondary" disabled={Boolean(busyId) || index === 0} onClick={() => move(workspace, -1)} aria-label="Move workspace up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="secondary" disabled={Boolean(busyId) || index === active.length - 1} onClick={() => move(workspace, 1)} aria-label="Move workspace down"><ArrowDown className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={Boolean(busyId) || names[workspace.id]?.trim() === workspace.name} onClick={() => saveName(workspace)}>Save</Button>
                  <Button variant="danger" disabled={Boolean(busyId)} onClick={() => setArchived(workspace, true)}><Archive className="h-4 w-4" /> Archive</Button>
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted">/{workspace.slug}</p>
            </Panel>
          ))}
        </div>
      </div>

      {archived.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-extrabold text-ink">Archived</h3>
          <div className="space-y-2">
            {archived.map((workspace) => (
              <Panel key={workspace.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-bold text-copy">{workspace.name}</p>
                  <p className="font-mono text-[10px] text-muted">/{workspace.slug}</p>
                </div>
                <Button variant="secondary" disabled={Boolean(busyId)} onClick={() => setArchived(workspace, false)}><RotateCcw className="h-4 w-4" /> Restore</Button>
              </Panel>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
