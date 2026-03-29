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

  useEffect(() => {
    // A quick peek at the GET response to determine flow type
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.ok) {
          // Even on error, the _flow flag may be present in legacy errors
          setFlow("legacy");
          return;
        }
        setFlow(json.data._flow === "new" ? "new" : "legacy");
      })
      .catch(() => setFlow("legacy"));
  }, [token]);

  if (flow === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (flow === "new") {
    return <SigningCeremony token={token} />;
  }

  // Legacy flow
  return <DocSignClient token={token} />;
}
