import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

import {
  REQUEST_PRIORITY_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  workRequestsApi,
} from "../api/workRequests";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";

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
    <PageContainer className="max-w-3xl">
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link to="/requests"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      </Button>
      <PageHeader
        eyebrow="Request intake"
        title="Submit a work request"
        description="Send a Creative & Design request for triage."
      />
      <Panel className="p-5 sm:p-6">
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Request title" className="sm:col-span-2">
            <Input required value={form.title} onChange={updateForm("title")} />
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
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </Panel>
    </PageContainer>
  );
}
