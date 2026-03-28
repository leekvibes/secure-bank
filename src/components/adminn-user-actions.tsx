"use client";

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

const PLANS = ["FREE", "BEGINNER", "PRO", "AGENCY"];

interface Props {
  userId: string;
  currentPlan: string;
  planOverride: string | null;
  planOverrideNote: string | null;
  isBanned: boolean;
  emailVerified: boolean;
}

export function AdminnnUserActions({ userId, currentPlan, planOverride, planOverrideNote, isBanned, emailVerified }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [overrideNote, setOverrideNote] = useState(planOverrideNote ?? "");
  const [banNote, setBanNote] = useState("");

  async function doAction(action: string, extra?: Record<string, string>) {
    setLoading(action);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/adminn/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuccess(action);
      setTimeout(() => { setSuccess(null); window.location.reload(); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-300">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Action completed successfully.
        </div>
      )}

      {/* Plan Override */}
      <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Plan Override</h3>
          <p className="text-xs text-white/40 mt-0.5">Manually set plan regardless of Stripe status. Protected from webhook overwrites.</p>
          {planOverride && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-medium">Manual Override Active</span>
              {planOverrideNote && <span className="text-xs text-white/40">&ldquo;{planOverrideNote}&rdquo;</span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PLANS.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPlan(p)}
              className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                selectedPlan === p
                  ? "bg-[#00A3FF]/20 border-[#00A3FF]/60 text-[#00A3FF]"
                  : "bg-white/5 border-white/10 text-white/50 hover:border-white/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <input
          value={overrideNote}
          onChange={(e) => setOverrideNote(e.target.value)}
          placeholder="Reason (e.g. testing, gifted access, promo)"
          className="w-full h-10 bg-black/20 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00A3FF]/40"
        />

        <div className="flex gap-2">
          <button
            onClick={() => doAction("PLAN_OVERRIDE", { value: selectedPlan, note: overrideNote })}
            disabled={loading !== null}
            className="flex-1 h-10 bg-[#00A3FF] text-white text-sm font-semibold rounded-xl hover:bg-[#0091E6] disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading === "PLAN_OVERRIDE" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Plan"}
          </button>
          {planOverride && (
            <button
              onClick={() => doAction("CLEAR_OVERRIDE")}
              disabled={loading !== null}
              className="h-10 px-4 bg-white/5 border border-white/10 text-white/60 text-sm font-medium rounded-xl hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {loading === "CLEAR_OVERRIDE" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clear Override"}
            </button>
          )}
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-[#0D1425] rounded-2xl border border-white/10 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Account Actions</h3>

        {!emailVerified && (
          <button
            onClick={() => doAction("VERIFY_EMAIL")}
            disabled={loading !== null}
            className="w-full h-10 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium rounded-xl hover:bg-emerald-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading === "VERIFY_EMAIL" ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓ Manually Verify Email"}
          </button>
        )}

        <button
          onClick={() => doAction("RESET_PASSWORD")}
          disabled={loading !== null}
          className="w-full h-10 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium rounded-xl hover:bg-blue-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading === "RESET_PASSWORD" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Password Reset Email"}
        </button>

        {!isBanned ? (
          <div className="space-y-2">
            <input
              value={banNote}
              onChange={(e) => setBanNote(e.target.value)}
              placeholder="Ban reason (required)"
              className="w-full h-10 bg-black/20 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
            <button
              onClick={() => { if (!banNote.trim()) { setError("Ban reason required."); return; } doAction("BAN", { note: banNote }); }}
              disabled={loading !== null}
              className="w-full h-10 bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-medium rounded-xl hover:bg-red-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading === "BAN" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ban Account"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => doAction("UNBAN")}
            disabled={loading !== null}
            className="w-full h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading === "UNBAN" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unban Account"}
          </button>
        )}
      </div>
    </div>
  );
}
