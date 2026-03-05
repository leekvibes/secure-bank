"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FIELD_TYPES, SENSITIVE_FIELD_TYPES, type FormFieldType } from "@/lib/schemas";

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text",
  email: "Email",
  phone: "Phone",
  address: "Address",
  date: "Date",
  dropdown: "Dropdown",
  ssn: "Social Security Number",
  routing: "Routing Number",
  bank_account: "Bank Account Number",
  signature: "Signature",
};

const FIELD_TYPE_DESCRIPTIONS: Record<FormFieldType, string> = {
  text: "Single-line text input",
  email: "Email address with validation",
  phone: "Phone number",
  address: "Street address",
  date: "Date picker",
  dropdown: "Select from a list of options",
  ssn: "SSN — auto-encrypted",
  routing: "9-digit routing — auto-encrypted",
  bank_account: "Account number — auto-encrypted",
  signature: "Hand-drawn signature",
};

interface FieldDraft {
  id: string;
  label: string;
  fieldType: FormFieldType;
  placeholder: string;
  helpText: string;
  required: boolean;
  encrypted: boolean;
  maskInput: boolean;
  confirmField: boolean;
  dropdownOptions: string; // newline-separated
}

function makeField(): FieldDraft {
  return {
    id: crypto.randomUUID(),
    label: "",
    fieldType: "text",
    placeholder: "",
    helpText: "",
    required: false,
    encrypted: true,
    maskInput: false,
    confirmField: false,
    dropdownOptions: "",
  };
}

export default function NewFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [fields, setFields] = useState<FieldDraft[]>([makeField()]);

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((fs) => [...fs, makeField()]);
  }

  function removeField(id: string) {
    setFields((fs) => fs.filter((f) => f.id !== id));
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields((fs) => {
      const idx = fs.findIndex((f) => f.id === id);
      if (idx < 0) return fs;
      const next = idx + dir;
      if (next < 0 || next >= fs.length) return fs;
      const copy = [...fs];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Form title is required."); return; }
    if (fields.length === 0) { setError("Add at least one field."); return; }

    const invalidField = fields.find((f) => !f.label.trim());
    if (invalidField) { setError("All fields must have a label."); return; }

    setLoading(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      retentionDays,
      fields: fields.map((f, idx) => ({
        label: f.label.trim(),
        fieldType: f.fieldType,
        placeholder: f.placeholder || undefined,
        helpText: f.helpText || undefined,
        required: f.required,
        encrypted: SENSITIVE_FIELD_TYPES.includes(f.fieldType) ? true : f.encrypted,
        maskInput: f.maskInput,
        confirmField: f.confirmField,
        dropdownOptions:
          f.fieldType === "dropdown"
            ? f.dropdownOptions.split("\n").map((s) => s.trim()).filter(Boolean)
            : undefined,
        order: idx,
      })),
    };

    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create form.");
      return;
    }

    router.push(`/dashboard/forms/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/forms">
            <ArrowLeft className="w-4 h-4" />
            Back to forms
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New form</h1>
        <p className="text-sm text-slate-500 mt-1">
          Build a custom form — fields are encrypted and delivered securely.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form meta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Form details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Form title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Insurance Application, Enrollment Form"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description shown to clients at the top of the form"
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retention">Data retention</Label>
              <select
                id="retention"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={-1}>Manual deletion</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Fields <span className="text-slate-400 font-normal">({fields.length})</span>
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="w-3.5 h-3.5" />
              Add field
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const isSensitive = SENSITIVE_FIELD_TYPES.includes(field.fieldType);
              return (
                <Card key={field.id} className="relative">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    {/* Row 1: Order controls + type + delete */}
                    <div className="flex items-start gap-2">
                      {/* Order buttons */}
                      <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveField(field.id, -1)}
                          disabled={idx === 0}
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(field.id, 1)}
                          disabled={idx === fields.length - 1}
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Field type */}
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs text-slate-500">Field type</Label>
                        <select
                          value={field.fieldType}
                          onChange={(e) => {
                            const t = e.target.value as FormFieldType;
                            updateField(field.id, {
                              fieldType: t,
                              encrypted: SENSITIVE_FIELD_TYPES.includes(t) ? true : field.encrypted,
                              maskInput: SENSITIVE_FIELD_TYPES.includes(t) ? true : field.maskInput,
                              confirmField: SENSITIVE_FIELD_TYPES.includes(t) ? true : field.confirmField,
                            });
                          }}
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {FIELD_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-400">{FIELD_TYPE_DESCRIPTIONS[field.fieldType]}</p>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        disabled={fields.length === 1}
                        className="mt-5 shrink-0 text-slate-300 hover:text-red-500 disabled:opacity-20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Label */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Label *</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder={`e.g. ${FIELD_TYPE_LABELS[field.fieldType]}`}
                        className="h-9 text-sm"
                      />
                    </div>

                    {/* Placeholder + help */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Placeholder</Label>
                        <Input
                          value={field.placeholder}
                          onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                          placeholder="Optional hint"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Help text</Label>
                        <Input
                          value={field.helpText}
                          onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                          placeholder="Optional note below field"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Dropdown options */}
                    {field.fieldType === "dropdown" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Options (one per line)</Label>
                        <textarea
                          value={field.dropdownOptions}
                          onChange={(e) => updateField(field.id, { dropdownOptions: e.target.value })}
                          placeholder={"Option A\nOption B\nOption C"}
                          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Options toggles */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Toggle
                        active={field.required}
                        onClick={() => updateField(field.id, { required: !field.required })}
                        label="Required"
                      />
                      <Toggle
                        active={isSensitive ? true : field.encrypted}
                        onClick={() => !isSensitive && updateField(field.id, { encrypted: !field.encrypted })}
                        label={
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Encrypted{isSensitive && " (always)"}
                          </span>
                        }
                        disabled={isSensitive}
                      />
                      <Toggle
                        active={field.maskInput}
                        onClick={() => updateField(field.id, { maskInput: !field.maskInput })}
                        label={
                          <span className="flex items-center gap-1">
                            {field.maskInput ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            Mask input
                          </span>
                        }
                      />
                      <Toggle
                        active={field.confirmField}
                        onClick={() => updateField(field.id, { confirmField: !field.confirmField })}
                        label="Confirm field"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addField} className="mt-3 w-full">
            <Plus className="w-3.5 h-3.5" />
            Add another field
          </Button>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" asChild className="flex-1">
            <Link href="/dashboard/forms">Cancel</Link>
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Creating..." : "Create form"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-blue-50 border-blue-200 text-blue-700"
          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
      } ${disabled ? "opacity-60 cursor-default" : "cursor-pointer"}`}
    >
      {label}
    </button>
  );
}
