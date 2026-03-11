"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const VERIFICATION_OPTIONS = ["UNVERIFIED", "LICENSED", "CERTIFIED", "REGULATED"] as const;
type VerificationStatus = (typeof VERIFICATION_OPTIONS)[number];

interface Props {
  userId: string;
  currentStatus: string;
}

export function VerificationEditor({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    if (next === value) return;
    setSaving(true);
    setValue(next);
    await fetch(`/api/admin/accounts/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="text-xs rounded-lg border border-border bg-card px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        {VERIFICATION_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
