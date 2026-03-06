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
    <main className="min-h-screen bg-gradient-to-br from-[hsl(222,30%,8%)] via-[hsl(220,25%,12%)] to-[hsl(218,30%,10%)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220,80%,50%,0.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(220,70%,40%,0.05),transparent_50%)]" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <Link href="/" className="flex items-center gap-3 justify-center mb-10 group">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-glow transition-shadow duration-300 group-hover:shadow-[0_0_30px_-5px_hsl(220,80%,50%,0.3)]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">Agent Secure Links</span>
        </Link>

        <Card className="glass-card border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-2xl shadow-black/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl text-white">
              {token ? "Set new password" : "Reset your password"}
            </CardTitle>
            <CardDescription className="text-blue-200/50">
              {token
                ? "Choose a new password for your account."
                : "Enter your email and we'll send a reset link if an account exists."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              requestSent ? (
                <div className="text-center py-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 ring-1 ring-emerald-500/20">
                    <Mail className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-blue-100/60 mb-6">
                    If an account exists for that email, you&apos;ll receive a reset
                    link shortly. Check your inbox.
                  </p>
                  <Button asChild variant="outline" className="w-full border-white/[0.1] bg-white/[0.03] text-white hover:bg-white/[0.06]">
                    <Link href="/auth">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to sign in
                    </Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-blue-100/70">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="you@agency.com"
                      className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-glow-sm text-white font-medium" disabled={requestLoading}>
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
                    <Link href="/auth" className="text-blue-300/60 hover:text-blue-300 transition-colors inline-flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )
            ) : done ? (
              <div className="text-center py-6">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-sm text-blue-100/60 mb-6">
                  Password updated. You can now sign in with your new password.
                </p>
                <Button asChild className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-glow-sm text-white font-medium">
                  <Link href="/auth">Sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-blue-100/70">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-glow-sm text-white font-medium" disabled={loading}>
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

        <p className="mt-6 text-center text-xs text-white/20">
          Protected by end-to-end encryption
        </p>
      </div>
    </main>
  );
}
