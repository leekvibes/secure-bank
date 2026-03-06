"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
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
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to your agent dashboard"
                : "Start sending secure links to clients"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {mode === "signin" ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@agency.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <div className="text-right">
                  <Link
                    href="/auth/reset"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Your name</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    required
                    placeholder="Alex Rivera"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agencyName">
                    Agency name{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="agencyName"
                    name="agencyName"
                    placeholder="Rivera Financial Group"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@agency.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    className="text-blue-600 hover:underline font-medium"
                    onClick={() => { setMode("signup"); setError(null); }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-blue-600 hover:underline font-medium"
                    onClick={() => { setMode("signin"); setError(null); }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
