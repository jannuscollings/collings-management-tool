import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Archive, ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";

import { workApi } from "../../api/work";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import Panel from "../ui/Panel";

export default function WorkspaceManagerPanel({ onChanged, onDirty, onBusy }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [names, setNames] = useState({});
  const [newWorkspace, setNewWorkspace] = useState({ name: "", board_names: [""] });
  const [boards, setBoards] = useState({});
  const [boardNames, setBoardNames] = useState({});
  const [newBoards, setNewBoards] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await workApi.listWorkspaces({ include_archived: true });
      const boardEntries = await Promise.all(data.map(async (workspace) => [workspace.id, (await workApi.listBoards(workspace.slug)).data]));
      const nextBoards = Object.fromEntries(boardEntries);
      setWorkspaces(data);
      setBoards(nextBoards);
      setBoardNames(Object.fromEntries(boardEntries.flatMap(([, list]) => list.map((board) => [board.id, board.name]))));
      setNewBoards({});
      setNames(Object.fromEntries(data.map((workspace) => [workspace.id, workspace.name])));
    } catch {
      toast.error("Couldn't load workspace management");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => (
    Boolean(newWorkspace.name || newWorkspace.board_names.some(Boolean) || newWorkspace.board_names.length > 1)
    || workspaces.some((workspace) => names[workspace.id] !== workspace.name)
    || Object.values(newBoards).some(Boolean)
    || Object.values(boards).flat().some((board) => boardNames[board.id] !== board.name)
  ), [names, newWorkspace, workspaces, newBoards, boards, boardNames]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onBusy(Boolean(busyId)); }, [busyId, onBusy]);

  const create = async (event) => {
    event.preventDefault();
    const boardNames = newWorkspace.board_names.map((name) => name.trim());
    if (boardNames.some((name) => !name) || new Set(boardNames.map((name) => name.toLowerCase())).size !== boardNames.length) {
      toast.error("Enter a unique name for each board");
      return;
    }
    setBusyId("create");
    try {
      const { data } = await workApi.createWorkspace({
        name: newWorkspace.name.trim(),
        board_names: boardNames,
      });
      toast.success(`${data.name} created`);
      setNewWorkspace({ name: "", board_names: [""] });
      await load();
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.slug?.[0] || error.response?.data?.name?.[0] || error.response?.data?.board_names?.[0] || "Couldn't create the workspace");
    } finally {
      setBusyId(null);
    }
  };

  const boardError = (error, fallback) => toast.error(error.response?.data?.detail || error.response?.data?.name?.[0] || error.response?.data?.board_ids?.[0] || fallback);

  const addBoard = async (workspace) => {
    const name = (newBoards[workspace.id] || "").trim();
    if (!name) return;
    setBusyId(workspace.id);
    try {
      const { data } = await workApi.addBoard(workspace.slug, name);
      setBoards((current) => ({ ...current, [workspace.id]: data }));
      setBoardNames((current) => ({ ...current, [data[data.length - 1].id]: name }));
      setNewBoards((current) => ({ ...current, [workspace.id]: "" }));
      onChanged();
      toast.success("Board added");
    } catch (error) { boardError(error, "Couldn't add the board"); }
    finally { setBusyId(null); }
  };

  const renameBoard = async (workspace, board) => {
    const name = (boardNames[board.id] || "").trim();
    if (!name || name === board.name) return;
    setBusyId(workspace.id);
    try {
      const { data } = await workApi.renameBoard(workspace.slug, board.id, name);
      setBoards((current) => ({ ...current, [workspace.id]: data }));
      setBoardNames((current) => ({ ...current, [board.id]: name }));
      onChanged();
      toast.success("Board renamed");
    } catch (error) { boardError(error, "Couldn't rename the board"); }
    finally { setBusyId(null); }
  };

  const deleteBoard = async (workspace, board) => {
    if (!window.confirm(`Delete empty board ${board.name}? This cannot be undone.`)) return;
    setBusyId(workspace.id);
    try {
      const { data } = await workApi.deleteBoard(workspace.slug, board.id);
      setBoards((current) => ({ ...current, [workspace.id]: data }));
      onChanged();
      toast.success("Board deleted");
    } catch (error) { boardError(error, "Couldn't delete the board"); }
    finally { setBusyId(null); }
  };

  const moveBoard = async (workspace, index, direction) => {
    const reordered = [...boards[workspace.id]];
    const target = index + direction;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusyId(workspace.id);
    try {
      const { data } = await workApi.reorderBoards(workspace.slug, reordered.map((board) => board.id));
      setBoards((current) => ({ ...current, [workspace.id]: data }));
      onChanged();
      toast.success("Board order saved");
    } catch (error) { boardError(error, "Couldn't reorder boards"); }
    finally { setBusyId(null); }
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
        <p className="mt-1 text-xs text-muted">Add the boards this workspace needs.</p>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Workspace name">
            <Input required value={newWorkspace.name} onChange={(event) => setNewWorkspace((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Boards</p>
            {newWorkspace.board_names.map((name, index) => <div key={index} className="flex gap-2">
              <Input required aria-label={`Board ${index + 1}`} value={name} onChange={(event) => setNewWorkspace((current) => ({ ...current, board_names: current.board_names.map((value, i) => i === index ? event.target.value : value) }))} />
              <Button variant="secondary" disabled={newWorkspace.board_names.length === 1} onClick={() => setNewWorkspace((current) => ({ ...current, board_names: current.board_names.filter((_, i) => i !== index) }))}>Remove</Button>
            </div>)}
            <Button variant="secondary" onClick={() => setNewWorkspace((current) => ({ ...current, board_names: [...current.board_names, ""] }))}>+ Add board</Button>
          </div>
          <div className="sm:col-span-2">
            <div className="flex gap-2"><Button type="submit" disabled={Boolean(busyId)}>Create workspace</Button><Button variant="secondary" disabled={Boolean(busyId)} onClick={() => setNewWorkspace({ name: "", board_names: [""] })}>Cancel</Button></div>
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
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">Boards</p>
                <div className="space-y-2">
                  {(boards[workspace.id] || []).map((board, boardIndex, list) => <div key={board.id} className="flex flex-wrap items-center gap-2">
                    <Input className="min-w-32 flex-1" aria-label={`Rename ${board.name}`} value={boardNames[board.id] ?? board.name} onChange={(event) => setBoardNames((current) => ({ ...current, [board.id]: event.target.value }))} />
                    {(board.work_item_count > 0 || board.request_count > 0) && <span className="text-xs text-muted">{board.work_item_count} work items · {board.request_count} requests</span>}
                    <Button size="icon" variant="secondary" disabled={Boolean(busyId) || boardIndex === 0} onClick={() => moveBoard(workspace, boardIndex, -1)} aria-label={`Move ${board.name} up`}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="secondary" disabled={Boolean(busyId) || boardIndex === list.length - 1} onClick={() => moveBoard(workspace, boardIndex, 1)} aria-label={`Move ${board.name} down`}><ArrowDown className="h-4 w-4" /></Button>
                    {boardNames[board.id] !== board.name && <><Button variant="secondary" disabled={Boolean(busyId) || !boardNames[board.id]?.trim()} onClick={() => renameBoard(workspace, board)}>Save</Button><Button variant="secondary" onClick={() => setBoardNames((current) => ({ ...current, [board.id]: board.name }))}>Cancel</Button></>}
                    <Button size="icon" variant="danger" disabled={Boolean(busyId) || list.length === 1 || board.work_item_count > 0 || board.request_count > 0} title={board.work_item_count > 0 ? "Move work items manually before deleting this board" : board.request_count > 0 ? "This board is used by requests" : list.length === 1 ? "A workspace needs one board" : "Delete empty board"} onClick={() => deleteBoard(workspace, board)} aria-label={`Delete ${board.name}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>)}
                  <div className="flex flex-wrap gap-2"><Input className="min-w-32 flex-1" aria-label={`New board in ${workspace.name}`} placeholder="New board name" value={newBoards[workspace.id] || ""} onChange={(event) => setNewBoards((current) => ({ ...current, [workspace.id]: event.target.value }))} /><Button variant="secondary" disabled={Boolean(busyId) || !newBoards[workspace.id]?.trim()} onClick={() => addBoard(workspace)}>Add board</Button>{newBoards[workspace.id] && <Button variant="secondary" onClick={() => setNewBoards((current) => ({ ...current, [workspace.id]: "" }))}>Cancel</Button>}</div>
                </div>
              </div>
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
