"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Lock, Eye, EyeOff,
  GripVertical, Pencil, X, Save, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type FormFieldType =
  | "text" | "email" | "phone" | "address" | "date"
  | "dropdown" | "ssn" | "routing" | "bank_account" | "signature";

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text", email: "Email", phone: "Phone", address: "Address",
  date: "Date", dropdown: "Dropdown", ssn: "SSN", routing: "Routing #",
  bank_account: "Bank Account", signature: "Signature",
};

const SENSITIVE_TYPES: FormFieldType[] = ["ssn", "routing", "bank_account"];

interface FieldData {
  id: string;
  label: string;
  fieldType: string;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  encrypted: boolean;
  maskInput: boolean;
  confirmField: boolean;
  dropdownOptions: string | null;
}

interface FormFieldEditorProps {
  formId: string;
  initialFields: FieldData[];
}

interface FieldDraft {
  id: string;
  isNew?: boolean;
  label: string;
  fieldType: FormFieldType;
  placeholder: string;
  helpText: string;
  required: boolean;
  encrypted: boolean;
  maskInput: boolean;
  confirmField: boolean;
  dropdownOptions: string;
}

function fieldToForm(f: FieldData): FieldDraft {
  return {
    id: f.id,
    label: f.label,
    fieldType: f.fieldType as FormFieldType,
    placeholder: f.placeholder ?? "",
    helpText: f.helpText ?? "",
    required: f.required,
    encrypted: f.encrypted,
    maskInput: f.maskInput,
    confirmField: f.confirmField,
    dropdownOptions: f.dropdownOptions
      ? (() => { try { return JSON.parse(f.dropdownOptions).join(", "); } catch { return f.dropdownOptions; } })()
      : "",
  };
}

function makeField(): FieldDraft {
  return {
    id: crypto.randomUUID(),
    isNew: true,
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

export function FormFieldEditor({ formId, initialFields }: FormFieldEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldDraft[]>(initialFields.map(fieldToForm));

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f) => {
      if (f.id !== id) return f;
      const updated = { ...f, ...patch };
      if (patch.fieldType && SENSITIVE_TYPES.includes(patch.fieldType)) {
        updated.encrypted = true;
        updated.maskInput = true;
      }
      return updated;
    }));
  }

  function removeField(id: string) {
    setFields((fs) => fs.filter((f) => f.id !== id));
  }

  function moveField(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= fields.length) return;
    setFields((fs) => {
      const copy = [...fs];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function addField() {
    setFields((fs) => [...fs, makeField()]);
  }

  function cancelEdit() {
    setFields(initialFields.map(fieldToForm));
    setEditing(false);
  }

  async function saveFields() {
    const invalid = fields.find((f) => !f.label.trim());
    if (invalid) {
      toast({ title: "Missing label", description: "Every field must have a label.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = fields.map((f) => ({
        ...(f.isNew ? {} : { id: f.id }),
        label: f.label.trim(),
        fieldType: f.fieldType,
        placeholder: f.placeholder || undefined,
        helpText: f.helpText || undefined,
        required: f.required,
        encrypted: f.encrypted,
        maskInput: f.maskInput,
        confirmField: f.confirmField,
        dropdownOptions: f.fieldType === "dropdown" && f.dropdownOptions
          ? f.dropdownOptions.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      }));

      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save fields");
      }

      toast({ title: "Fields updated", description: "Form fields have been saved." });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit Fields
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Editing Fields</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={saveFields} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save Fields
          </Button>
        </div>
      </div>

      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="bg-card border border-border/60 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground bg-surface-2 px-2 py-0.5 rounded shrink-0">
              {idx + 1}
            </span>
            <Input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              placeholder="e.g. Full Name, Email, Phone Number"
              className="h-8 text-sm flex-1"
            />
            <select
              value={field.fieldType}
              onChange={(e) => updateField(field.id, { fieldType: e.target.value as FormFieldType })}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs"
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FormFieldType[]).map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <div className="flex gap-0.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveField(idx, -1)} disabled={idx === 0}>
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}>
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeField(field.id)} disabled={fields.length <= 1}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Example text inside the field</Label>
              <Input
                value={field.placeholder}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                placeholder="e.g. Enter your full name"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hint shown below the field</Label>
              <Input
                value={field.helpText}
                onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                placeholder="e.g. As it appears on your bank statement"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {field.fieldType === "dropdown" && (
            <div>
              <Label className="text-xs text-muted-foreground">Options (comma-separated)</Label>
              <Input
                value={field.dropdownOptions}
                onChange={(e) => updateField(field.id, { dropdownOptions: e.target.value })}
                placeholder="Option A, Option B, Option C"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer" title="Client must fill this out">
              <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} className="rounded" />
              Required
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Extra protection for sensitive data">
              <input type="checkbox" checked={field.encrypted} onChange={(e) => updateField(field.id, { encrypted: e.target.checked })} className="rounded" />
              <Lock className="w-3 h-3" /> Encrypt
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Shows dots instead of characters while typing">
              <input type="checkbox" checked={field.maskInput} onChange={(e) => updateField(field.id, { maskInput: e.target.checked })} className="rounded" />
              {field.maskInput ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} Hide input
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" title="Client enters value twice to avoid typos">
              <input type="checkbox" checked={field.confirmField} onChange={(e) => updateField(field.id, { confirmField: e.target.checked })} className="rounded" />
              Enter twice
            </label>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addField} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add Field
      </Button>
    </div>
  );
}
