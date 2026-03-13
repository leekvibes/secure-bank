"use client";

import { useState } from "react";
import { Copy, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function TransferActions({
  transferId,
  url,
  expired,
}: {
  transferId: string;
  url: string;
  expired: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/transfers/${transferId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {!expired && (
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Copy link"
        >
          {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            {deleting ? "Deleting…" : "Confirm"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
