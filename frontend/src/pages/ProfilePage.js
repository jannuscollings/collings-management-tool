import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Camera, Trash2 } from "lucide-react";
import { authApi } from "../api/auth";
import { loadUser } from "../store/slices/authSlice";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import ProfileAvatar from "../components/profile/ProfileAvatar";

const fields = (user) => ({ first_name: user?.first_name || "", last_name: user?.last_name || "", bio: user?.bio || "" });
const apiError = (error, fallback) => {
  const details = error.response?.data;
  const message = details?.photo || details?.bio || details?.first_name || details?.last_name || details?.detail;
  return (Array.isArray(message) ? message[0] : message) || fallback;
};

export default function ProfilePage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => fields(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!editing) setForm(fields(user)); }, [editing, user]);
  if (!user) return <PageContainer><p role="status" className="text-sm text-muted">Loading profile…</p></PageContainer>;

  const refresh = async () => { await dispatch(loadUser()); };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await authApi.updateProfile({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), bio: form.bio.trim() });
      await refresh();
      setEditing(false);
      setNotice("Profile updated.");
    } catch (requestError) { setError(apiError(requestError, "Couldn't update your profile.")); }
    finally { setBusy(false); }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await authApi.uploadPhoto(file);
      await refresh();
      setNotice("Profile photo updated.");
    } catch (requestError) { setError(apiError(requestError, "Couldn't upload the photo.")); }
    finally { setBusy(false); event.target.value = ""; }
  };
  const remove = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      await authApi.removePhoto();
      await refresh();
      setNotice("Profile photo removed.");
    } catch (requestError) { setError(apiError(requestError, "Couldn't remove the photo.")); }
    finally { setBusy(false); }
  };
  const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  return <PageContainer className="pb-16 shell:pb-[34px]">
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="My Profile" description="Manage how your name and photo appear in CMT." />
      <Panel className="mb-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <ProfileAvatar user={user} className="h-20 w-20 text-xl sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-xl font-extrabold text-ink">{name}</h2>
            <p className="mt-1 break-words text-sm text-copy">{user.job_title || "No job title set"}</p>
            <Badge className="mt-2" variant={user.is_staff ? "brand" : "neutral"}>{user.is_staff ? "Admin" : "Staff"}</Badge>
          </div>
          {!editing && <Button variant="secondary" className="min-h-11 shell:min-h-[38px]" onClick={() => { setError(""); setNotice(""); setEditing(true); }}>Edit Profile</Button>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} tabIndex={-1} className="sr-only" aria-label="Choose profile photo" />
          <Button variant="secondary" className="min-h-11 shell:min-h-[38px]" disabled={busy} onClick={() => inputRef.current?.click()}><Camera className="h-4 w-4" />{user.has_photo ? "Replace photo" : "Upload photo"}</Button>
          {user.has_photo && <Button variant="ghost" className="min-h-11 shell:min-h-[38px]" disabled={busy} onClick={remove}><Trash2 className="h-4 w-4" />Remove photo</Button>}
          <p className="w-full text-xs text-muted">JPEG, PNG, or WebP. Up to 5 MB.</p>
        </div>
      </Panel>
      {error && <p role="alert" className="mb-4 text-sm text-critical">{error}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-positive">{notice}</p>}
      {editing && <Panel className="mb-5 p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-ink">Edit Profile</h2>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><Input maxLength={150} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></Field>
          <Field label="Last name"><Input maxLength={150} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></Field>
          <Field label="Professional bio" className="sm:col-span-2"><Textarea rows={3} maxLength={500} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></Field>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </div>
        </form>
      </Panel>}
      <Panel className="p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-ink">Profile details</h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Work email</dt><dd className="mt-1 break-all text-copy">{user.email}</dd></div>
          <div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Job title</dt><dd className="mt-1 break-words text-copy">{user.job_title || "Managed by an Admin"}</dd></div>
          <div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Access</dt><dd className="mt-1 text-copy">{user.is_staff ? "Admin" : "Staff"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Professional bio</dt><dd className="mt-1 whitespace-pre-wrap break-words text-copy">{user.bio || "No bio added yet."}</dd></div>
        </dl>
      </Panel>
    </div>
  </PageContainer>;
}
