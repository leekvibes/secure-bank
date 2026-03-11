"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string;
  isBanned: boolean;
  isAdmin: boolean;
}

type UIState = "idle" | "confirming-delete" | "confirming-ban";

export function AccountActions({ userId, isBanned, isAdmin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"ban" | "unban" | "delete" | null>(null);
  const [uiState, setUiState] = useState<UIState>("idle");
  const [banReason, setBanReason] = useState("");

  async function handleBanConfirm() {
    if (!banReason.trim()) return;
    setLoading("ban");
    await fetch(`/api/admin/accounts/${userId}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: banReason.trim() }),
    });
    setLoading(null);
    setUiState("idle");
    setBanReason("");
    router.refresh();
  }

  async function handleUnban() {
    setLoading("unban");
    await fetch(`/api/admin/accounts/${userId}/unban`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  async function handleDeleteConfirm() {
    setLoading("delete");
    await fetch(`/api/admin/accounts/${userId}`, { method: "DELETE" });
    setLoading(null);
    setUiState("idle");
    router.refresh();
  }

  if (isAdmin) return null;

  if (uiState === "confirming-delete") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-red-600 font-medium">Delete?</span>
        <button
          onClick={handleDeleteConfirm}
          disabled={!!loading}
          className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50 hover:bg-red-700 transition-colors"
        >
          {loading === "delete" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
        </button>
        <button
          onClick={() => setUiState("idle")}
          disabled={!!loading}
          className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (uiState === "confirming-ban") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="text"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="Ban reason…"
          className="text-xs px-2 py-1 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleBanConfirm()}
        />
        <button
          onClick={handleBanConfirm}
          disabled={!!loading || !banReason.trim()}
          className="text-xs px-2 py-1 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 hover:bg-amber-700 transition-colors"
        >
          {loading === "ban" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ban"}
        </button>
        <button
          onClick={() => { setUiState("idle"); setBanReason(""); }}
          disabled={!!loading}
          className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <>
      {isBanned ? (
        <button
          onClick={handleUnban}
          disabled={!!loading}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors font-medium disabled:opacity-50"
        >
          {loading === "unban" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Unban"}
        </button>
      ) : (
        <button
          onClick={() => setUiState("confirming-ban")}
          disabled={!!loading}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors font-medium disabled:opacity-50"
        >
          Ban
        </button>
      )}
      <button
        onClick={() => setUiState("confirming-delete")}
        disabled={!!loading}
        className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
      >
        Delete
      </button>
    </>
  );
}
