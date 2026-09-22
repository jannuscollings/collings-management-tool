import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

import {
  REQUEST_PRIORITY_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  workRequestsApi,
} from "../api/workRequests";

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    brief: "",
    request_type: "creative_design",
    priority: "medium",
    requested_due_date: "",
  });

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await workRequestsApi.create({
        ...form,
        title: form.title.trim(),
        requested_due_date: form.requested_due_date || null,
      });
      toast.success(`${data.reference} submitted`);
      navigate(`/requests/${data.id}`);
    } catch (error) {
      const message = error.response?.data?.title?.[0] || "Couldn't submit the request";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8">
      <Link to="/requests" className="mb-5 inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">
        <ArrowLeft className="h-4 w-4" /> Requests
      </Link>
      <header className="mb-7"><h1 className="text-2xl font-semibold">Submit a work request</h1><p className="mt-1 text-sm opacity-60">Send a Creative &amp; Design request for triage.</p></header>
      <form onSubmit={submit} className="grid gap-5 rounded-xl border border-black/10 p-5 dark:border-white/10 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Request title</span><input required value={form.title} onChange={updateForm("title")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Brief</span><textarea rows="5" value={form.brief} onChange={updateForm("brief")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-white/15" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Request type</span><select value={form.request_type} onChange={updateForm("request_type")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{REQUEST_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Priority</span><select value={form.priority} onChange={updateForm("priority")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15">{REQUEST_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Requested due date</span><input type="date" value={form.requested_due_date} onChange={updateForm("requested_due_date")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/15" /></label>
        <div className="self-end"><button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50">{saving ? "Submitting…" : "Submit request"}</button></div>
      </form>
    </div>
  );
}

