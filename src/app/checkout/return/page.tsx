"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

const MAX_SYNC_RETRIES = 8;
const SYNC_RETRY_DELAY_MS = 1200;

function ReturnInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Backward-compatible fallback:
    // Older return URLs could accidentally place session_id inside `next`.
    let resolvedSessionId = sessionId;
    let next = nextParam;

    if (!resolvedSessionId && nextParam.includes("session_id=")) {
      try {
        const parsed = new URL(nextParam, window.location.origin);
        const embeddedSessionId = parsed.searchParams.get("session_id");
        if (embeddedSessionId) {
          resolvedSessionId = embeddedSessionId;
          parsed.searchParams.delete("session_id");
          next = `${parsed.pathname}${parsed.search}`;
        }
      } catch {
        // Ignore parse failure and continue with standard error path.
      }
    }

    if (!resolvedSessionId) {
      setStatus("error");
      setMessage("No session ID found. Please contact support.");
      return;
    }

    let cancelled = false;

    async function syncPlanWithRetry() {
      for (let attempt = 0; attempt < MAX_SYNC_RETRIES; attempt += 1) {
        try {
          const response = await fetch("/api/stripe/sync-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: resolvedSessionId }),
          });
          const data = await response.json().catch(() => ({}));

          const resolvedPlan =
            (typeof data?.plan === "string" ? data.plan : null) ??
            (typeof data?.data?.plan === "string" ? data.data.plan : null);

          if (resolvedPlan) {
            if (cancelled) return;
            setStatus("success");
            setMessage(`Welcome to the ${resolvedPlan.charAt(0) + resolvedPlan.slice(1).toLowerCase()} plan!`);
            setTimeout(() => { window.location.href = next; }, 2000);
            return;
          }

          const code =
            (typeof data?.error?.code === "string" ? data.error.code : null) ??
            (typeof data?.code === "string" ? data.code : null);
          const message =
            (typeof data?.error?.message === "string" ? data.error.message : null) ??
            (typeof data?.message === "string" ? data.message : null);

          if (code === "CHECKOUT_PENDING" && attempt < MAX_SYNC_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, SYNC_RETRY_DELAY_MS));
            continue;
          }

          if (cancelled) return;
          setStatus("error");
          setMessage(message ?? "Failed to activate your plan. Please contact support.");
          return;
        } catch {
          if (attempt < MAX_SYNC_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, SYNC_RETRY_DELAY_MS));
            continue;
          }
          if (cancelled) return;
          setStatus("error");
          setMessage("Network error. Please contact support.");
          return;
        }
      }
    }

    syncPlanWithRetry();

    return () => {
      cancelled = true;
    };
  }, [sessionId, nextParam]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm w-full space-y-4">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 border-3 border-[#00A3FF] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Activating your plan…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">Payment successful!</h1>
            <p className="text-sm text-gray-500">{message}</p>
            <p className="text-xs text-gray-400">Redirecting you now…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500">{message}</p>
            <p className="text-xs text-gray-400 mt-1">If your card was charged, your plan may still activate within a few minutes. Check your dashboard settings.</p>
            <div className="flex flex-col gap-2 mt-3">
              <Link href="/dashboard/settings" className="inline-block text-sm font-medium text-[#00A3FF] hover:underline">
                Go to settings →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00A3FF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReturnInner />
    </Suspense>
  );
}
