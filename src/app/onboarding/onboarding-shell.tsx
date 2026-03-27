"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

const STEPS = [
  { label: "Profile", path: "/onboarding/profile" },
  { label: "Trust", path: "/onboarding/trust" },
  { label: "Branding", path: "/onboarding/branding" },
  { label: "Choose Plan", path: "/onboarding/plan" },
  { label: "First Request", path: "/onboarding/first-request" },
  { label: "Done", path: "/onboarding/success" },
];

interface OnboardingShellProps {
  currentStep: number;
  children: React.ReactNode;
}

export function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <BrandLogo size="sm" />
        </Link>
        <span className="text-xs text-muted-foreground">
          Step {currentStep} of {STEPS.length}
        </span>
      </header>

      <div className="px-6 py-2 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                      isCompleted && "bg-primary text-white",
                      isCurrent && "bg-primary text-white ring-4 ring-primary/15",
                      !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium whitespace-nowrap",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 mt-[-18px] rounded-full",
                      stepNum < currentStep ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
