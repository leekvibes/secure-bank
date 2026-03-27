"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const PLAN_LABELS: Record<string, string> = {
  FREE:     "Free",
  BEGINNER: "Beginner — $15/mo",
  PRO:      "Pro — $29/mo",
  AGENCY:   "Agency — $70/mo",
};

const PLAN_COLORS: Record<string, string> = {
  FREE:     "bg-gray-100 text-gray-600",
  BEGINNER: "bg-blue-50 text-blue-700",
  PRO:      "bg-[#00A3FF]/10 text-[#0077CC]",
  AGENCY:   "bg-purple-50 text-purple-700",
};

interface Props {
  plan: string;
  hasSubscription: boolean;
}

export function BillingPanel({ plan, hasSubscription }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.data?.url) window.location.href = data.data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Billing & Plan</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Current plan</p>
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${PLAN_COLORS[plan] ?? PLAN_COLORS.FREE}`}>
            {PLAN_LABELS[plan] ?? "Free"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasSubscription && (
            <button
              onClick={openPortal}
              disabled={loading}
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Manage Billing
            </button>
          )}
          {plan !== "AGENCY" && (
            <Link
              href="/pricing"
              className="h-9 px-4 rounded-lg bg-[#00A3FF] text-white text-sm font-semibold hover:bg-[#0091E6] transition-colors flex items-center gap-1.5"
            >
              Upgrade <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {plan === "FREE" && (
        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          You are on the Free plan — 10 secure links/month. Upgrade to Pro for unlimited links, file transfers, and custom forms.
        </p>
      )}
      {plan === "BEGINNER" && (
        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          You are on the Beginner plan — 50 secure links/month. Upgrade to Pro for unlimited links, file transfers, and custom forms.
        </p>
      )}
    </div>
  );
}
