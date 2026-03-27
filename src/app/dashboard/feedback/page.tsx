"use client";

import { useState } from "react";
import { MessageSquare, CheckCircle2, Loader2, Bug, Lightbulb, Layout, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  { value: "BUG",     label: "Bug Report",       icon: Bug,        color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200",    activeBorder: "border-red-400 ring-1 ring-red-200 bg-red-50" },
  { value: "FEATURE", label: "Feature Request",  icon: Lightbulb,  color: "text-amber-500",  bg: "bg-amber-50",  border: "border-amber-200",  activeBorder: "border-amber-400 ring-1 ring-amber-200 bg-amber-50" },
  { value: "UX",      label: "UI / UX Feedback", icon: Layout,     color: "text-blue-500",   bg: "bg-blue-50",   border: "border-blue-200",   activeBorder: "border-blue-400 ring-1 ring-blue-200 bg-blue-50" },
  { value: "OTHER",   label: "General Feedback",  icon: HelpCircle, color: "text-slate-500",  bg: "bg-slate-50",  border: "border-slate-200",  activeBorder: "border-slate-400 ring-1 ring-slate-200 bg-slate-50" },
] as const;

type Category = "BUG" | "FEATURE" | "UX" | "OTHER";

export default function FeedbackPage() {
  const [category, setCategory] = useState<Category>("BUG");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error?.fieldErrors) setFieldErrors(data.error.fieldErrors);
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Thanks for the feedback</h1>
        <p className="text-muted-foreground mb-8">We read every submission and use it to improve the product.</p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(""); setCategory("BUG"); }}>
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Share Feedback</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Found a bug? Have a feature idea? Tell us — we use every submission to improve the product.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="text-sm font-medium text-foreground mb-3 block">Category</Label>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(({ value, label, icon: Icon, color, border, activeBorder }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  category === value ? activeBorder : `${border} hover:border-slate-300 bg-card`
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="message" className="text-sm font-medium text-foreground mb-1.5 block">
            Your feedback <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => { setMessage(e.target.value); if (fieldErrors.message) setFieldErrors({}); }}
            placeholder={
              category === "BUG"
                ? "Describe what happened and what you expected to happen. Steps to reproduce are super helpful."
                : category === "FEATURE"
                ? "Describe the feature you'd like. What problem does it solve?"
                : category === "UX"
                ? "What felt confusing or hard to use? What would make it better?"
                : "Share anything on your mind about the product."
            }
            rows={6}
            maxLength={2000}
            className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${
              fieldErrors.message ? "border-red-300" : "border-border"
            }`}
          />
          <div className="flex items-center justify-between mt-1">
            {fieldErrors.message ? (
              <p className="text-xs text-red-500">{fieldErrors.message}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground ml-auto">{message.length}/2000</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || message.trim().length < 10}
          className="w-full h-11 font-semibold"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </span>
          ) : (
            "Send Feedback"
          )}
        </Button>
      </form>
    </div>
  );
}
