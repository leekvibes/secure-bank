"use client";

import { useState } from "react";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  hasLogo: boolean;
  hasProfile: boolean;
  hasLinks: boolean;
  plan: string;
  onboardingCompleted: boolean;
}

interface ChecklistItem {
  label: string;
  done: boolean;
  optional?: boolean;
}

export function OnboardingChecklist({ hasLogo, hasProfile, hasLinks, plan, onboardingCompleted }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const items: ChecklistItem[] = [
    { label: "Create your account", done: true },
    { label: "Upload your logo", done: hasLogo },
    { label: "Complete your profile", done: hasProfile },
    { label: "Send your first secure link", done: hasLinks },
    { label: "Upgrade your plan", done: plan !== "FREE", optional: true },
  ];

  const requiredItems = items.filter((i) => !i.optional);
  const allRequiredDone = requiredItems.every((i) => i.done);
  const completedCount = items.filter((i) => i.done).length;

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      });
    } catch {
      // silently ignore — just dismiss the UI
    } finally {
      setDismissed(true);
      setDismissing(false);
    }
  }

  if (dismissed || onboardingCompleted) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">
              {completedCount}/{items.length}
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">
              {allRequiredDone ? "You're all set!" : "Getting started"}
            </p>
            <p className="text-xs text-muted-foreground">
              {allRequiredDone
                ? "All required steps complete."
                : `${completedCount} of ${items.length} steps complete`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allRequiredDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              disabled={dismissing}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-lg hover:bg-secondary border border-border"
            >
              {dismissing ? "Saving..." : "Dismiss"}
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  item.done
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-border bg-secondary"
                }`}
              >
                {item.done && <Check className="w-3 h-3 text-white" />}
              </div>
              <span
                className={`text-sm ${
                  item.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {item.label}
                {item.optional && (
                  <span className="ml-1.5 text-[11px] text-muted-foreground font-normal no-underline">
                    (optional)
                  </span>
                )}
              </span>
            </div>
          ))}

          {allRequiredDone && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-sm text-emerald-600 font-medium">
                You&apos;re all set! 🎉
              </p>
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {dismissing ? "Saving..." : "Dismiss"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
