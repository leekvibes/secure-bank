"use client";

import { useState } from "react";
import { Loader2, CreditCard, Check, ArrowRight } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  FREE:     "Free",
  BEGINNER: "Beginner",
  PRO:      "Pro",
  AGENCY:   "Agency",
};

const PLAN_COLORS: Record<string, string> = {
  FREE:     "bg-gray-100 text-gray-600",
  BEGINNER: "bg-blue-50 text-blue-700",
  PRO:      "bg-[#00A3FF]/10 text-[#0077CC]",
  AGENCY:   "bg-purple-50 text-purple-700",
};

const UPGRADES = [
  {
    key: "BEGINNER",
    name: "Beginner",
    price: "$15/mo",
    popular: false,
    features: ["50 links/month", "Email support", "Basic analytics"],
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$29/mo",
    popular: true,
    features: ["Unlimited links", "File transfers", "Custom forms", "Priority support"],
  },
  {
    key: "AGENCY",
    name: "Agency",
    price: "$70/mo",
    popular: false,
    features: ["Everything in Pro", "5 team members", "Branded links"],
  },
];

interface Props {
  plan: string;
  hasSubscription: boolean;
}

export function BillingPanel({ plan, hasSubscription }: Props) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data?.error?.message ?? "Unable to open billing portal.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  function startUpgrade(planKey: string) {
    setError(null);
    setUpgradeLoading(planKey);

    if (hasSubscription) {
      // Already a paying subscriber — send to Stripe portal to switch plans.
      // The portal handles proration automatically (enabled in Stripe dashboard).
      openPortal();
      return;
    }

    // No subscription yet — go through Stripe checkout to start one.
    window.location.href = `/checkout?plan=${planKey}&next=/dashboard/settings`;
  }

  const isPaid = plan !== "FREE";

  return (
    <div id="billing" className="rounded-xl border border-border bg-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Billing & Plan</h2>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${PLAN_COLORS[plan] ?? PLAN_COLORS.FREE}`}>
          {PLAN_LABELS[plan] ?? "Free"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Current plan description */}
      {plan === "FREE" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re on the Free plan — 10 secure links lifetime. Upgrade to unlock more links, file transfers, and custom forms.
        </p>
      )}
      {plan === "BEGINNER" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re on the Beginner plan — 50 secure links/month. Upgrade to Pro for unlimited links and all features.
        </p>
      )}
      {plan === "PRO" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re on the Pro plan — unlimited links, file transfers, custom forms, and priority support.
        </p>
      )}
      {plan === "AGENCY" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re on the Agency plan — all features plus up to 5 team members and branded links.
        </p>
      )}

      {/* Manage billing for paid subscribers */}
      {isPaid && (
        <button
          onClick={openPortal}
          disabled={portalLoading || upgradeLoading !== null}
          className="w-full h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          Manage Billing, Upgrade or Cancel
        </button>
      )}

      {/* Upgrade options */}
      {plan !== "AGENCY" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {isPaid ? "Upgrade your plan" : "Available plans"}
          </p>
          {isPaid && (
            <p className="text-xs text-muted-foreground">
              Clicking upgrade takes you to your billing portal where Stripe handles the plan switch and prorates any difference automatically.
            </p>
          )}
          <div className="grid gap-2">
            {UPGRADES.filter((u) => {
              if (plan === "FREE") return true;
              if (plan === "BEGINNER") return u.key === "PRO" || u.key === "AGENCY";
              if (plan === "PRO") return u.key === "AGENCY";
              return false;
            }).map((upgrade) => (
              <div
                key={upgrade.key}
                className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
                  upgrade.popular ? "border-primary/40 bg-primary/3" : "border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{upgrade.name}</span>
                    {upgrade.popular && (
                      <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">Popular</span>
                    )}
                    <span className="text-sm font-bold text-foreground ml-auto">{upgrade.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {upgrade.features.map((f) => (
                      <span key={f} className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3 text-primary shrink-0" />{f}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => startUpgrade(upgrade.key)}
                  disabled={upgradeLoading !== null || portalLoading}
                  className="shrink-0 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {upgradeLoading === upgrade.key || (isPaid && portalLoading)
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><span>Upgrade</span><ArrowRight className="w-3.5 h-3.5" /></>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Payments secured by Stripe · Cancel anytime · No hidden fees
      </p>
    </div>
  );
}
