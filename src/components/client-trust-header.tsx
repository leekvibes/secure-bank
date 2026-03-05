"use client";

import { useState } from "react";
import {
  Lock, Shield, Clock, BadgeCheck, ChevronDown, X,
  Phone, Building2, Mail,
} from "lucide-react";

export interface AgentProfile {
  displayName: string;
  agencyName: string | null;
  company: string | null;
  industry: string | null;
  destinationLabel: string | null;
  licenseNumber: string | null;
  verificationStatus: string;
  phone: string | null;
  email?: string | null;
}

interface Props {
  logoUrls: string[];
  agent: AgentProfile;
  expiresAt: string;
  isViewOnce?: boolean;
}

const VERIFICATION = {
  LICENSED: { label: "Licensed Agent", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CERTIFIED: { label: "Certified Agent", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  REGULATED: { label: "Regulated Professional", cls: "bg-violet-50 text-violet-700 border-violet-200" },
} as const;

export function ClientTrustHeader({ logoUrls, agent, expiresAt, isViewOnce }: Props) {
  const [agentOpen, setAgentOpen] = useState(false);

  const expiresDate = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const verification = VERIFICATION[agent.verificationStatus as keyof typeof VERIFICATION];

  const initials = agent.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const companyLine = [agent.company ?? agent.agencyName, agent.industry]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">

      {/* ── Desktop bar: center logos, right agent card ── */}
      <div className="hidden sm:block">
        <div className="max-w-screen-md mx-auto px-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 gap-6">

            {/* Left: empty spacer mirrors right side so logos stay centered */}
            <div />

            {/* Center: logo strip */}
            <LogoStrip logoUrls={logoUrls} />

            {/* Right: expanded agent identity card */}
            <div className="flex justify-end">
              <AgentCardDesktop
                agent={agent}
                initials={initials}
                verification={verification}
                companyLine={companyLine}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile bar: logos pinned center, agent toggle on right ── */}
      <div className="sm:hidden relative flex items-center h-14 px-4">
        {/* Logos: absolute center so they're truly centered regardless of button width */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
          <LogoStrip logoUrls={logoUrls} />
        </div>

        {/* Agent toggle: pinned right */}
        <button
          onClick={() => setAgentOpen((v) => !v)}
          className="ml-auto relative z-10 flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors"
          aria-expanded={agentOpen}
          aria-label="View agent details"
        >
          <Avatar initials={initials} size="sm" />
          {verification && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${agentOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* ── Mobile agent drawer ── */}
      {agentOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-4 shadow-md">
          <AgentCardDrawer
            agent={agent}
            initials={initials}
            verification={verification}
            companyLine={companyLine}
            onClose={() => setAgentOpen(false)}
          />
        </div>
      )}

      {/* ── Trust strip ── */}
      <div className="border-t border-slate-100 bg-slate-50/80">
        <div className="max-w-screen-md mx-auto px-4 h-7 flex items-center gap-4 overflow-x-auto scrollbar-none">
          <TrustPill icon={Lock} label="AES-256" />
          <Divider />
          <TrustPill icon={Shield} label="Private" />
          <Divider />
          <TrustPill icon={Clock} label={`Expires ${expiresDate}`} />
          {isViewOnce && (
            <>
              <Divider />
              <TrustPill icon={Shield} label="One-time link" />
            </>
          )}
          {agent.destinationLabel && (
            <>
              <Divider />
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                Submitted to:{" "}
                <span className="text-slate-600 font-medium">{agent.destinationLabel}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LogoStrip({ logoUrls }: { logoUrls: string[] }) {
  if (logoUrls.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
          <Lock className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 overflow-x-auto scrollbar-none max-w-[260px]">
      {logoUrls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt="Logo"
          className="h-8 max-h-8 max-w-[120px] w-auto object-contain shrink-0"
        />
      ))}
    </div>
  );
}

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "sm" ? "w-7 h-7 text-xs" :
    size === "lg" ? "w-11 h-11 text-base" :
    "w-9 h-9 text-sm";
  return (
    <div className={`${cls} rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 ring-2 ring-blue-50`}>
      {initials}
    </div>
  );
}

function AgentCardDesktop({
  agent, initials, verification, companyLine,
}: {
  agent: AgentProfile;
  initials: string;
  verification: { label: string; cls: string } | undefined;
  companyLine: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 max-w-[260px]">
      <Avatar initials={initials} />
      <div className="min-w-0 space-y-0.5">
        {/* Name */}
        <p className="text-sm font-semibold text-slate-900 leading-tight truncate">
          {agent.displayName}
        </p>

        {/* Company / agency */}
        {companyLine && (
          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{companyLine}</span>
          </p>
        )}

        {/* Verification badge */}
        {verification && (
          <div className="pt-0.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border leading-none ${verification.cls}`}>
              <BadgeCheck className="w-2.5 h-2.5" />
              {verification.label}
            </span>
          </div>
        )}

        {/* License */}
        {agent.licenseNumber && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <span className="text-slate-300 font-bold text-[10px]">#</span>
            License {agent.licenseNumber}
          </p>
        )}

        {/* Phone */}
        {agent.phone && (
          <a
            href={`tel:${agent.phone}`}
            className="text-xs text-slate-500 flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            {agent.phone}
          </a>
        )}

        {/* Email */}
        {agent.email && (
          <a
            href={`mailto:${agent.email}`}
            className="text-xs text-slate-500 flex items-center gap-1 hover:text-blue-600 transition-colors truncate max-w-full"
          >
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{agent.email}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function AgentCardDrawer({
  agent, initials, verification, companyLine, onClose,
}: {
  agent: AgentProfile;
  initials: string;
  verification: { label: string; cls: string } | undefined;
  companyLine: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight">{agent.displayName}</p>
            {companyLine && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{companyLine}</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 shrink-0 mt-0.5"
          aria-label="Close agent details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {verification && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${verification.cls}`}>
            <BadgeCheck className="w-3.5 h-3.5" />
            {verification.label}
          </span>
        )}
        {agent.licenseNumber && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            # License {agent.licenseNumber}
          </span>
        )}
      </div>

      {/* Contact row */}
      {(agent.phone || agent.email) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
          {agent.phone && (
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {agent.phone}
            </a>
          )}
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors truncate"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{agent.email}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TrustPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
      <Icon className="w-2.5 h-2.5 text-slate-400" />
      {label}
    </div>
  );
}

function Divider() {
  return <span className="text-slate-200 select-none shrink-0">·</span>;
}
