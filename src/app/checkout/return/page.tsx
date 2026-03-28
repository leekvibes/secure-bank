"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

function ReturnInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const next = searchParams.get("next") ?? "/dashboard";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("No session ID found. Please contact support.");
      return;
    }

    fetch("/api/stripe/sync-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data?.plan) {
          setStatus("success");
          setMessage(`Welcome to the ${data.data.plan.charAt(0) + data.data.plan.slice(1).toLowerCase()} plan!`);
          // Hard redirect so the dashboard server component re-renders fresh from DB
          setTimeout(() => { window.location.href = next; }, 2000);
        } else {
          setStatus("error");
          setMessage(data.error?.message ?? "Failed to activate your plan. Please contact support.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please contact support.");
      });
  }, [sessionId, next]);

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
            <Link href="/dashboard/settings" className="inline-block mt-2 text-sm font-medium text-[#00A3FF] hover:underline">
              Go to settings →
            </Link>
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
