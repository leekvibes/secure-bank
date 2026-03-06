"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid email or password.");
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      const body = {
        email: form.get("email"),
        password: form.get("password"),
        displayName: form.get("displayName"),
        agencyName: form.get("agencyName"),
      };

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: body.email,
          password: body.password,
        }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        setError(loginData.error ?? "Account created, but sign-in failed. Please sign in manually.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-xl text-white">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription className="text-blue-200/50">
              {mode === "signin"
                ? "Sign in to your agent dashboard"
                : "Start sending secure links to clients"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                {error}
              </div>
            )}

            {mode === "signin" ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-blue-100/70">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@agency.com"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-blue-100/70">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-glow-sm text-white font-medium" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
                <div className="text-right">
                  <Link
                    href="/auth/reset"
                    className="text-xs text-blue-300/60 hover:text-blue-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-blue-100/70">Your name</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    required
                    placeholder="Alex Rivera"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agencyName" className="text-blue-100/70">
                    Agency name{" "}
                    <span className="text-white/30 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="agencyName"
                    name="agencyName"
                    placeholder="Rivera Financial Group"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-blue-100/70">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@agency.com"
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-blue-100/70">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-glow-sm text-white font-medium" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Create account
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-white/[0.06] text-center text-sm text-blue-200/40">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    className="text-primary hover:text-blue-400 font-medium transition-colors"
                    onClick={() => { setMode("signup"); setError(null); }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-primary hover:text-blue-400 font-medium transition-colors"
                    onClick={() => { setMode("signin"); setError(null); }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/20">
          Protected by end-to-end encryption
        </p>
      </div>
    </main>
  );
}
