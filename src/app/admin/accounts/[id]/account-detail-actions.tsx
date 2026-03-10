"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string;
  isBanned: boolean;
  isAdmin: boolean;
}

export function AccountDetailActions({ userId, isBanned, isAdmin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"ban" | "unban" | "delete" | null>(null);

  async function handleBan() {
    const reason = prompt("Enter ban reason:");
    if (!reason) return;
    setLoading("ban");
    await fetch(`/api/admin/accounts/${userId}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setLoading(null);
    router.refresh();
  }

  async function handleUnban() {
    setLoading("unban");
    await fetch(`/api/admin/accounts/${userId}/unban`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this account and all associated data? This cannot be undone.")) return;
    setLoading("delete");
    await fetch(`/api/admin/accounts/${userId}`, { method: "DELETE" });
    setLoading(null);
    router.push("/admin/accounts");
  }

  if (isAdmin) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {isBanned ? (
        <button
          onClick={handleUnban}
          disabled={!!loading}
          className="text-sm px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors font-medium disabled:opacity-50"
        >
          {loading === "unban" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Unban Account"}
        </button>
      ) : (
        <button
          onClick={handleBan}
          disabled={!!loading}
          className="text-sm px-3 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors font-medium disabled:opacity-50"
        >
          {loading === "ban" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Ban Account"}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={!!loading}
        className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
      >
        {loading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete Account"}
      </button>
    </div>
  );
}
