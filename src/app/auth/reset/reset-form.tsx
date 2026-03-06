"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, KeyRound, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
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

  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,94%)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/" className="flex items-center gap-3 justify-center mb-10 group">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Secure Link</span>
        </Link>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center mb-4 ring-1 ring-primary/15">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">
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
                <div className="text-center py-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 ring-1 ring-emerald-200">
                    <Mail className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    If an account exists for that email, you&apos;ll receive a reset
                    link shortly. Check your inbox.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/auth">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to sign in
                    </Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRequest} className="space-y-4">
                  <div className="space-y-2">
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
                  <Button type="submit" className="w-full h-11 font-medium" disabled={requestLoading}>
                    {requestLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                  <div className="text-center text-sm">
                    <Link href="/auth" className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )
            ) : done ? (
              <div className="text-center py-6">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4 ring-1 ring-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Password updated. You can now sign in with your new password.
                </p>
                <Button asChild className="w-full h-11 font-medium">
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
                <div className="space-y-2">
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
                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    "Set new password"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Protected by end-to-end encryption
        </p>
      </div>
    </main>
  );
}
