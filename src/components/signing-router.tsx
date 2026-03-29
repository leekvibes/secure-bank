"use client";

/**
 * Routing shim: fetches the signing data once, determines the flow type,
 * and passes the pre-loaded data to the ceremony so it never needs to re-fetch.
 */
import { useEffect, useState } from "react";
import { SigningCeremony } from "./signing-ceremony";
import { DocSignClient } from "./docsign-client";

type FlowState = "loading" | "new" | "legacy" | "error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SigningRouter({ token }: { token: string }) {
  const [flow, setFlow] = useState<FlowState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Pre-loaded data for the new flow — passed directly to SigningCeremony
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [initialData, setInitialData] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        // Try to parse JSON regardless of status
        const json = await r.json().catch(() => ({})) as Record<string, unknown>;
        if (!r.ok) {
          const msg =
            (json?.error as { message?: string } | undefined)?.message ??
            (r.status === 410 ? "This signing link is no longer available." : "Unable to load signing link.");
          setErrorMessage(msg);
          setFlow("error");
          return;
        }
        if (json._flow === "new") {
          setInitialData(json);
          setFlow("new");
        } else {
          setFlow("legacy");
        }
      })
      .catch(() => {
        setErrorMessage("Unable to load signing link. Please check your connection and try again.");
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
    // Pass the pre-fetched data so the ceremony doesn't make a redundant second request
    return <SigningCeremony token={token} initialData={initialData} />;
  }

  // Legacy flow
  return <DocSignClient token={token} />;
}
