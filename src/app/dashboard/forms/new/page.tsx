"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock, Eye, EyeOff, MonitorSmartphone, GripVertical, Zap, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FIELD_TYPES, SENSITIVE_FIELD_TYPES, type FormFieldType } from "@/lib/schemas";

const FIELD_TYPE_CONFIG: Record<FormFieldType, {
  label: string;
  description: string;
  icon: string;
  defaultLabel: string;
  defaultPlaceholder: string;
  defaultHelpText: string;
  defaultRequired: boolean;
  defaultConfirm: boolean;
}> = {
  text: {
    label: "Text",
    description: "A general text field for names, notes, or any other info",
    icon: "Aa",
    defaultLabel: "Full Name",
    defaultPlaceholder: "e.g. John Smith",
    defaultHelpText: "",
    defaultRequired: true,
    defaultConfirm: false,
  },
  email: {
    label: "Email Address",
    description: "Validates that the entry is a real email format",
    icon: "@",
    defaultLabel: "Email Address",
    defaultPlaceholder: "name@example.com",
    defaultHelpText: "",
    defaultRequired: true,
    defaultConfirm: false,
  },
  phone: {
    label: "Phone Number",
    description: "Formatted phone number entry",
    icon: "#",
    defaultLabel: "Phone Number",
    defaultPlaceholder: "(555) 123-4567",
    defaultHelpText: "",
    defaultRequired: true,
    defaultConfirm: false,
  },
  address: {
    label: "Street Address",
    description: "Full street address with city, state, and zip",
    icon: "Pin",
    defaultLabel: "Home Address",
    defaultPlaceholder: "123 Main St, City, State ZIP",
    defaultHelpText: "Include apartment or unit number if applicable",
    defaultRequired: true,
    defaultConfirm: false,
  },
  date: {
    label: "Date",
    description: "A calendar date picker (birthdays, start dates, etc.)",
    icon: "Cal",
    defaultLabel: "Date of Birth",
    defaultPlaceholder: "MM/DD/YYYY",
    defaultHelpText: "",
    defaultRequired: true,
    defaultConfirm: false,
  },
  dropdown: {
    label: "Multiple Choice",
    description: "A list of options your client picks from",
    icon: "List",
    defaultLabel: "Select an Option",
    defaultPlaceholder: "Choose one...",
    defaultHelpText: "",
    defaultRequired: true,
    defaultConfirm: false,
  },
  ssn: {
    label: "Social Security Number",
    description: "Encrypted, masked SSN entry with confirmation",
    icon: "SSN",
    defaultLabel: "Social Security Number",
    defaultPlaceholder: "XXX-XX-XXXX",
    defaultHelpText: "Your SSN is encrypted immediately and never stored in plain text",
    defaultRequired: true,
    defaultConfirm: true,
  },
  routing: {
    label: "Bank Routing Number",
    description: "9-digit routing number with bank verification",
    icon: "Bank",
    defaultLabel: "Routing Number",
    defaultPlaceholder: "9-digit routing number",
    defaultHelpText: "Found on the bottom-left of your check",
    defaultRequired: true,
    defaultConfirm: false,
  },
  bank_account: {
    label: "Bank Account Number",
    description: "Encrypted account number with confirmation for accuracy",
    icon: "Acct",
    defaultLabel: "Account Number",
    defaultPlaceholder: "Enter account number",
    defaultHelpText: "Your account number is encrypted immediately",
    defaultRequired: true,
    defaultConfirm: true,
  },
  signature: {
    label: "Signature",
    description: "Your client draws their signature on screen",
    icon: "Sig",
    defaultLabel: "Signature",
    defaultPlaceholder: "",
    defaultHelpText: "Sign using your finger or mouse",
    defaultRequired: true,
    defaultConfirm: false,
  },
};

const STARTER_TEMPLATES = [
  {
    name: "Client Contact Info",
    description: "Collect name, email, and phone",
    icon: FileText,
    fields: [
      { fieldType: "text" as FormFieldType, label: "Full Name", placeholder: "e.g. John Smith", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "email" as FormFieldType, label: "Email Address", placeholder: "name@example.com", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "phone" as FormFieldType, label: "Phone Number", placeholder: "(555) 123-4567", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "address" as FormFieldType, label: "Home Address", placeholder: "123 Main St, City, State ZIP", helpText: "Include apartment or unit number if applicable", required: false, encrypted: false, maskInput: false, confirmField: false },
    ],
  },
  {
    name: "Banking Details",
    description: "Routing and account numbers",
    icon: Shield,
    fields: [
      { fieldType: "text" as FormFieldType, label: "Full Name", placeholder: "e.g. John Smith", helpText: "Name as it appears on your bank account", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "routing" as FormFieldType, label: "Routing Number", placeholder: "9-digit routing number", helpText: "Found on the bottom-left of your check", required: true, encrypted: true, maskInput: true, confirmField: false },
      { fieldType: "bank_account" as FormFieldType, label: "Account Number", placeholder: "Enter account number", helpText: "Your account number is encrypted immediately", required: true, encrypted: true, maskInput: true, confirmField: true },
      { fieldType: "date" as FormFieldType, label: "Preferred Draft Date", placeholder: "MM/DD/YYYY", helpText: "Date you would like payments to be drafted", required: false, encrypted: false, maskInput: false, confirmField: false },
    ],
  },
  {
    name: "Full Application",
    description: "SSN, banking, address, and more",
    icon: Zap,
    fields: [
      { fieldType: "text" as FormFieldType, label: "Full Name", placeholder: "e.g. John Smith", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "date" as FormFieldType, label: "Date of Birth", placeholder: "MM/DD/YYYY", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "ssn" as FormFieldType, label: "Social Security Number", placeholder: "XXX-XX-XXXX", helpText: "Your SSN is encrypted immediately and never stored in plain text", required: true, encrypted: true, maskInput: true, confirmField: true },
      { fieldType: "address" as FormFieldType, label: "Home Address", placeholder: "123 Main St, City, State ZIP", helpText: "Include apartment or unit number if applicable", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "phone" as FormFieldType, label: "Phone Number", placeholder: "(555) 123-4567", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "email" as FormFieldType, label: "Email Address", placeholder: "name@example.com", helpText: "", required: true, encrypted: false, maskInput: false, confirmField: false },
      { fieldType: "routing" as FormFieldType, label: "Routing Number", placeholder: "9-digit routing number", helpText: "Found on the bottom-left of your check", required: true, encrypted: true, maskInput: true, confirmField: false },
      { fieldType: "bank_account" as FormFieldType, label: "Account Number", placeholder: "Enter account number", helpText: "Your account number is encrypted immediately", required: true, encrypted: true, maskInput: true, confirmField: true },
      { fieldType: "signature" as FormFieldType, label: "Signature", placeholder: "", helpText: "Sign using your finger or mouse", required: true, encrypted: false, maskInput: false, confirmField: false },
    ],
  },
];

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
  dropdownOptions: string;
  showAdvanced: boolean;
}

function makeField(type: FormFieldType = "text"): FieldDraft {
  const cfg = FIELD_TYPE_CONFIG[type];
  const isSensitive = SENSITIVE_FIELD_TYPES.includes(type);
  return {
    id: crypto.randomUUID(),
    label: cfg.defaultLabel,
    fieldType: type,
    placeholder: cfg.defaultPlaceholder,
    helpText: cfg.defaultHelpText,
    required: cfg.defaultRequired,
    encrypted: isSensitive ? true : false,
    maskInput: isSensitive,
    confirmField: cfg.defaultConfirm,
    dropdownOptions: "",
    showAdvanced: false,
  };
}

function makeFieldFrom(template: typeof STARTER_TEMPLATES[0]["fields"][0]): FieldDraft {
  return {
    id: crypto.randomUUID(),
    label: template.label,
    fieldType: template.fieldType,
    placeholder: template.placeholder,
    helpText: template.helpText,
    required: template.required,
    encrypted: template.encrypted,
    maskInput: template.maskInput,
    confirmField: template.confirmField,
    dropdownOptions: "",
    showAdvanced: false,
  };
}

export default function NewFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const retentionDays = -1;
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [started, setStarted] = useState(false);

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addField(type: FormFieldType = "text") {
    setFields((fs) => [...fs, makeField(type)]);
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

  function applyTemplate(t: typeof STARTER_TEMPLATES[0]) {
    setFields(t.fields.map(makeFieldFrom));
    setStarted(true);
    if (!title.trim()) setTitle(t.name);
  }

  function changeFieldType(id: string, newType: FormFieldType) {
    const cfg = FIELD_TYPE_CONFIG[newType];
    const isSensitive = SENSITIVE_FIELD_TYPES.includes(newType);
    updateField(id, {
      fieldType: newType,
      label: cfg.defaultLabel,
      placeholder: cfg.defaultPlaceholder,
      helpText: cfg.defaultHelpText,
      encrypted: isSensitive ? true : false,
      maskInput: isSensitive,
      confirmField: cfg.defaultConfirm,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Give your form a name so you can find it later."); return; }
    if (fields.length === 0) { setError("Add at least one field to your form."); return; }

    const invalidField = fields.find((f) => !f.label.trim());
    if (invalidField) { setError("Every field needs a name. Check for any blank fields."); return; }

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
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/dashboard/forms/${data.id}`);
  }

  if (!started && fields.length === 0) {
    return (
      <div className="animate-fade-in max-w-2xl">
        <div className="mb-5">
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link href="/dashboard/new">
              <ArrowLeft className="w-4 h-4" />
              Create Secure Link
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="ui-page-title">Create a New Form</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a starting point, or build your own from scratch.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {STARTER_TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5 text-left transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description} — {t.fields.length} fields, ready to customize</p>
                </div>
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Use this
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 border-t border-border/40" />
          <p className="relative text-center text-xs text-muted-foreground bg-background px-4 mx-auto w-fit">
            or
          </p>
        </div>

        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => { setFields([makeField("text")]); setStarted(true); }}
            className="w-full py-6 text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Start from scratch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in ${showPreview ? "max-w-[1200px]" : "max-w-2xl"}`}>
      <div className="mb-5">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/dashboard/new">
            <ArrowLeft className="w-4 h-4" />
            Create Secure Link
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="ui-page-title">Build Your Form</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the fields below. Your client will see this as a clean, secure form.
          </p>
        </div>
        <Button
          type="button"
          variant={showPreview ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPreview((p) => !p)}
          className="shrink-0 gap-1.5"
        >
          <MonitorSmartphone className="w-3.5 h-3.5" />
          {showPreview ? "Hide preview" : "Preview"}
        </Button>
      </div>

      <div className={showPreview ? "grid xl:grid-cols-[1fr_380px] gap-8 items-start" : ""}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What is this form for?</CardTitle>
            <CardDescription className="text-xs">
              Give your form a name and an optional description so your client knows what they are filling out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Form name *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Client Application, Insurance Enrollment, Document Request"
                required
              />
              <p className="text-xs text-muted-foreground">This is how you will find this form in your dashboard</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Instructions for your client{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Please fill out the information below to complete your enrollment. All information is encrypted and secure."
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50 resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Your client sees this at the top of the form</p>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Form Fields <span className="text-muted-foreground font-normal">({fields.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Each card below becomes a field your client fills out</p>
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const cfg = FIELD_TYPE_CONFIG[field.fieldType];
              const isSensitive = SENSITIVE_FIELD_TYPES.includes(field.fieldType);
              return (
                <Card key={field.id} className="relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${isSensitive ? "bg-primary/60" : "bg-border/60"}`} />
                  <CardContent className="pt-4 pb-4 pl-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveField(field.id, -1)}
                          disabled={idx === 0}
                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(field.id, 1)}
                          disabled={idx === fields.length - 1}
                          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border/40 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">{cfg.icon}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {field.label || "Unnamed field"}
                          </span>
                          {isSensitive && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              Encrypted
                            </span>
                          )}
                          {field.required && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 shrink-0">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{cfg.description}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateField(field.id, { showAdvanced: !field.showAdvanced })}
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded"
                          title="Show settings"
                        >
                          {field.showAdvanced ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          disabled={fields.length === 1}
                          className="p-1 text-muted-foreground/40 hover:text-red-500 disabled:opacity-20 transition-colors"
                          title="Remove this field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {field.showAdvanced && (
                      <div className="space-y-3 pt-2 border-t border-border/30">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">What type of information?</Label>
                            <select
                              value={field.fieldType}
                              onChange={(e) => changeFieldType(field.id, e.target.value as FormFieldType)}
                              className="flex h-9 w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50"
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {FIELD_TYPE_CONFIG[t].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Field name (what your client sees)</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                              placeholder={cfg.defaultLabel}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Example text shown inside the field</Label>
                            <Input
                              value={field.placeholder}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder={cfg.defaultPlaceholder || "e.g. Enter your answer here"}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Hint shown below the field</Label>
                            <Input
                              value={field.helpText}
                              onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                              placeholder="e.g. This is found on your bank statement"
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                        {field.fieldType === "dropdown" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">List of choices (one per line)</Label>
                            <textarea
                              value={field.dropdownOptions}
                              onChange={(e) => updateField(field.id, { dropdownOptions: e.target.value })}
                              placeholder={"Option 1\nOption 2\nOption 3"}
                              className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary/50 resize-none"
                              rows={3}
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Toggle
                            active={field.required}
                            onClick={() => updateField(field.id, { required: !field.required })}
                            label="Required"
                            hint="Client must fill this out"
                          />
                          {!isSensitive && (
                            <Toggle
                              active={field.encrypted}
                              onClick={() => updateField(field.id, { encrypted: !field.encrypted })}
                              label={
                                <span className="flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Encrypt
                                </span>
                              }
                              hint="Extra protection for sensitive data"
                            />
                          )}
                          <Toggle
                            active={field.maskInput}
                            onClick={() => updateField(field.id, { maskInput: !field.maskInput })}
                            label={
                              <span className="flex items-center gap-1">
                                {field.maskInput ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                Hide input
                              </span>
                            }
                            hint="Shows dots instead of numbers"
                          />
                          <Toggle
                            active={field.confirmField}
                            onClick={() => updateField(field.id, { confirmField: !field.confirmField })}
                            label="Enter twice"
                            hint="Client enters value twice to avoid typos"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground text-center">Add a field</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(["text", "email", "phone", "date", "address", "ssn", "routing", "bank_account", "dropdown", "signature"] as FormFieldType[]).map((t) => {
                const cfg = FIELD_TYPE_CONFIG[t];
                const isSensitive = SENSITIVE_FIELD_TYPES.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addField(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center hover:border-primary/40 hover:bg-primary/5 ${
                      isSensitive ? "border-primary/20 bg-primary/5" : "border-border/40 bg-card"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">{cfg.icon}</span>
                    <span className="text-[10px] text-foreground font-medium leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" asChild className="flex-1">
            <Link href="/dashboard/new">Cancel</Link>
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Creating..." : "Create Form"}
          </Button>
        </div>
      </form>

      {showPreview && (
        <div className="xl:sticky xl:top-6">
          <FormPreviewPane title={title} description={description} fields={fields} />
        </div>
      )}
      </div>
    </div>
  );
}

function FormPreviewPane({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: FieldDraft[];
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-surface-2 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-card flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
        </div>
        <span className="text-xs text-muted-foreground mx-auto">What your client sees</span>
      </div>

      <div className="p-4">
        <div className="bg-card rounded-xl border border-border/40 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {title || <span className="text-muted-foreground/40">Your form title</span>}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Please fill out the information below to securely submit your details.
            </p>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Add fields to see a preview.</p>
          ) : (
            fields.map((field) => (
              <PreviewField key={field.id} field={field} />
            ))
          )}

          <div className="h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-semibold">Submit Securely</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ field }: { field: FieldDraft }) {
  const isSensitive = SENSITIVE_FIELD_TYPES.includes(field.fieldType);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-foreground">
          {field.label || <span className="text-muted-foreground/40">Unlabeled field</span>}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {isSensitive && (
          <Lock className="w-2.5 h-2.5 text-primary/60 shrink-0" />
        )}
      </div>

      {field.fieldType === "dropdown" ? (
        <div className="relative">
          <div className="flex h-9 w-full items-center rounded-lg border border-border/40 bg-card px-3 pr-8 text-sm text-muted-foreground/50">
            {field.placeholder || "Select an option"}
          </div>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      ) : field.fieldType === "signature" ? (
        <div className="h-20 rounded-xl border-2 border-dashed border-border/40 bg-card flex items-center justify-center">
          <span className="text-xs text-muted-foreground/40">Signature area</span>
        </div>
      ) : field.fieldType === "date" ? (
        <div className="flex h-9 w-full items-center rounded-lg border border-border/40 bg-card px-3 text-sm text-muted-foreground/40">
          MM / DD / YYYY
        </div>
      ) : (
        <div className="flex h-9 w-full items-center rounded-lg border border-border/40 bg-card px-3 text-sm text-muted-foreground/40">
          {field.maskInput && isSensitive ? "••••••••" : (field.placeholder || FIELD_TYPE_CONFIG[field.fieldType].label)}
        </div>
      )}

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}

      {field.confirmField && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Confirm {field.label || "field"}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex h-9 w-full items-center rounded-lg border border-border/40 bg-card px-3 text-sm text-muted-foreground/40">
            {field.maskInput ? "••••••••" : `Re-enter ${(field.label || "value").toLowerCase()}`}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  disabled,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-card border-border/40 text-muted-foreground hover:border-border"
      } ${disabled ? "opacity-60 cursor-default" : "cursor-pointer"}`}
    >
      {label}
    </button>
  );
}
