"use client";

/**
 * Routing shim: detects whether the token belongs to the new recipient-based
 * signing flow or the legacy DocSignRequest flow, then renders the correct UI.
 */
import { useEffect, useState } from "react";
import { SigningCeremony } from "./signing-ceremony";
import { DocSignClient } from "./docsign-client";

type FlowState = "loading" | "new" | "legacy" | "error";

export function SigningRouter({ token }: { token: string }) {
  const [flow, setFlow] = useState<FlowState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Peek at the GET response to determine flow type.
    // apiSuccess returns data directly (no wrapper), so check r.ok and json._flow.
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = (json as { error?: { message?: string } })?.error?.message
            ?? (r.status === 410 ? "This signing link is no longer available." : "Unable to load signing link.");
          setErrorMessage(msg);
          setFlow("error");
          return;
        }
        // apiSuccess returns raw data — _flow is at the top level, not under .data
        setFlow((json as { _flow?: string })._flow === "new" ? "new" : "legacy");
      })
      .catch(() => {
        setErrorMessage("Unable to load signing link. Please try again.");
        setFlow("error");
      });
  }, [token]);

  if (flow === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (flow === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Link Unavailable</h1>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "This signing link is no longer available."}</p>
          <p className="text-xs text-muted-foreground">If you believe this is an error, contact the sender for a new link.</p>
        </div>
      </div>
    );
  }

  if (flow === "new") {
    return <SigningCeremony token={token} />;
  }

  // Legacy flow
  return <DocSignClient token={token} />;
}
