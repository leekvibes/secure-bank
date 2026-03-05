"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Request mode (no token in URL)
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Reset mode (token in URL)
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setRequestLoading(true);
    await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: requestEmail }),
    });
    setRequestLoading(false);
    setRequestSent(true);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/reset-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Reset failed.");
      return;
    }

    setDone(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-800">Agent Secure Links</span>
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {token ? "Set new password" : "Reset your password"}
            </CardTitle>
            <CardDescription>
              {token
                ? "Choose a new password for your account."
                : "Enter your email and we'll send a reset link if an account exists."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              requestSent ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-4">
                    If an account exists for that email, you'll receive a reset
                    link shortly. Check your inbox.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/auth">Back to sign in</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="you@agency.com"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={requestLoading}>
                    {requestLoading ? "Sending..." : "Send reset link"}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    <Link href="/auth" className="text-blue-600 hover:underline">
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )
            ) : done ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-600 mb-4">
                  Password updated. You can now sign in with your new password.
                </p>
                <Button asChild className="w-full">
                  <Link href="/auth">Sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating..." : "Set new password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
