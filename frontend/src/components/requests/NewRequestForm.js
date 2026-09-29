import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  REQUEST_PRIORITY_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  workRequestsApi,
} from "../../api/workRequests";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";

const initialForm = {
  title: "",
  brief: "",
  request_type: "creative_design",
  priority: "medium",
  requested_due_date: "",
};

export default function NewRequestForm({ onCreated, onDirty = () => {}, onBusy = () => {} }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form]);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => onBusy(saving), [saving, onBusy]);

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
      onDirty(false);
      onCreated(data);
    } catch (error) {
      const message = error.response?.data?.title?.[0] || "Couldn't submit the request";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-5 pb-16 shell:pb-0 sm:grid-cols-2">
      <Field label="Request title" className="sm:col-span-2">
        <Input required autoFocus value={form.title} onChange={updateForm("title")} />
      </Field>
      <Field label="Brief" className="sm:col-span-2">
        <Textarea rows="5" value={form.brief} onChange={updateForm("brief")} />
      </Field>
      <Field label="Request type">
        <Select value={form.request_type} onChange={updateForm("request_type")}>
          {REQUEST_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onChange={updateForm("priority")}>
          {REQUEST_PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      <Field label="Requested due date">
        <Input type="date" value={form.requested_due_date} onChange={updateForm("requested_due_date")} />
      </Field>
      <div className="flex items-end sm:justify-end">
        <Button type="submit" disabled={saving} className="min-h-11 w-full shell:min-h-[38px] sm:w-auto">
          {saving ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
