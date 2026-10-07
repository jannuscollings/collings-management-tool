import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { peopleApi } from "../api/people";
import { loadUser } from "../store/slices/authSlice";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import ProfileAvatar from "../components/profile/ProfileAvatar";

const blank = { first_name: "", last_name: "", email: "", job_title: "", role: "staff", password: "" };

export default function PeoplePage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try { setPeople((await peopleApi.list()).data); }
    catch { setError(true); toast.error("Couldn't load people"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.is_staff) load(); }, [user?.is_staff]);

  if (!user?.is_staff) return <Navigate to="/home" replace />;

  const edit = (person) => {
    setEditingId(person.id);
    setForm({ first_name: person.first_name, last_name: person.last_name, email: person.email, job_title: person.job_title || "", role: person.is_staff ? "admin" : "staff", password: "" });
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), job_title: form.job_title.trim(), is_staff: form.role === "admin" };
      if (!editingId) payload.password = form.password;
      if (editingId) await peopleApi.update(editingId, payload);
      else await peopleApi.create(payload);
      if (editingId === user.id) dispatch(loadUser());
      setForm(null);
      setEditingId(null);
      await load();
      toast.success(editingId ? "Person updated" : "Person created");
    } catch (requestError) {
      const details = requestError.response?.data;
      toast.error(details?.email?.[0] || details?.password?.[0] || details?.is_staff?.[0] || details?.detail || "Couldn't save this person");
    } finally { setBusy(false); }
  };
  const setActive = async (person) => {
    if (!person.is_active && person.is_superuser) return;
    if (person.is_active && !window.confirm(`Deactivate ${person.display_name}? Existing assignments and history will stay in place.`)) return;
    setBusy(true);
    try {
      await peopleApi.update(person.id, { is_active: !person.is_active });
      await load();
      toast.success(person.is_active ? "Person deactivated" : "Person reactivated");
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || "Couldn't change this person's status");
    } finally { setBusy(false); }
  };

  return <PageContainer className="pb-16 shell:pb-[34px]">
    <PageHeader eyebrow="Admin" title="People" description="Manage access while keeping work and history attached to each person."
      actions={<Button onClick={() => { setEditingId(null); setForm(blank); }}>New person</Button>} />
    {form && <Panel className="mb-6 p-4 shell:p-5">
      <h2 className="mb-4 text-sm font-extrabold text-ink">{editingId ? "Edit person" : "New person"}</h2>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><Input required maxLength={150} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></Field>
        <Field label="Last name"><Input required maxLength={150} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></Field>
        <Field label="Email"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Job title"><Input maxLength={150} value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} /></Field>
        <Field label="Access"><Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} disabled={Boolean(editingId === user.id || people.find((person) => person.id === editingId)?.is_superuser)}><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
        {!editingId && <Field label="Initial password" hint="At least 8 characters. Share it with the person separately."><Input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>}
        <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" disabled={busy} onClick={() => { setForm(null); setEditingId(null); }}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Create person"}</Button>
        </div>
      </form>
    </Panel>}
    {loading ? <p role="status" className="text-sm text-muted">Loading people…</p> : error ? <Panel className="p-4"><p role="alert" className="text-sm text-critical">Couldn't load people.</p><Button variant="secondary" className="mt-3" onClick={load}>Retry</Button></Panel> :
      <div className="space-y-3">{people.map((person) => <Panel key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileAvatar user={person} otherUser className="h-8 w-8 text-[10px]" />
          <div className="min-w-0">
          <p className="break-words text-sm font-bold text-ink">{person.display_name}</p>
          {person.job_title && <p className="break-words text-xs font-semibold text-copy">{person.job_title}</p>}
          <p className="break-all text-xs text-muted">{person.email}</p>
          <div className="mt-2 flex flex-wrap gap-2"><Badge variant={person.is_staff ? "brand" : "neutral"}>{person.is_staff ? "Admin" : "Staff"}</Badge><Badge variant={person.is_active ? "success" : "neutral"}>{person.is_active ? "Active" : "Inactive"}</Badge></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => edit(person)}>Edit</Button>
          <Button variant="secondary" disabled={busy || person.id === user.id || person.is_superuser} onClick={() => setActive(person)}>{person.is_active ? "Deactivate" : "Reactivate"}</Button>
        </div>
      </Panel>)}</div>}
  </PageContainer>;
}
