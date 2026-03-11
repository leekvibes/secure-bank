"use client";

import { useState } from "react";
import {
  Shield, Clock, BadgeCheck, ChevronDown, X,
  Phone, Building2, Mail, FileText, Lock,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

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
  photoUrl?: string | null;
}

interface Props {
  logoUrls: string[];
  agent: AgentProfile;
  expiresAt: string;
  isViewOnce?: boolean;
}

export function ClientTrustHeader({ logoUrls, agent, expiresAt, isViewOnce }: Props) {
  const [agentOpen, setAgentOpen] = useState(false);

  const expiresDate = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const initials = agent.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const companyName = agent.company ?? agent.agencyName;

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-blue-100 shadow-sm">

      <div className="hidden sm:block">
        <div className="max-w-screen-md mx-auto px-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 gap-6">
            <div />
            <LogoStrip logoUrls={logoUrls} />
            <div className="flex justify-end">
              <AgentCardDesktop
                agent={agent}
                initials={initials}
                companyName={companyName}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden relative flex items-center h-14 px-3">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
          <LogoStrip logoUrls={logoUrls} />
        </div>
        <button
          onClick={() => setAgentOpen((v) => !v)}
          className="ml-auto relative z-10 flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors"
          aria-expanded={agentOpen}
          aria-label="View sender details"
        >
          <Avatar initials={initials} photoUrl={agent.photoUrl} size="sm" />
          {agent.licenseNumber && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${agentOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {agentOpen && (
        <div className="sm:hidden border-t border-blue-100 bg-white/95 backdrop-blur-xl px-4 py-4 shadow-lg">
          <AgentCardDrawer
            agent={agent}
            initials={initials}
            companyName={companyName}
            onClose={() => setAgentOpen(false)}
          />
        </div>
      )}

      <div className="border-t border-blue-50 bg-gradient-to-r from-blue-50/60 via-slate-50/40 to-blue-50/60">
        <div className="max-w-screen-md mx-auto px-3 py-1.5 flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
          <TrustPill icon={Lock} label="Encrypted" />
          <Dot />
          <TrustPill icon={Clock} label={`Exp. ${expiresDate}`} />
          {isViewOnce && (
            <>
              <Dot />
              <TrustPill icon={Shield} label="One-Time Access" />
            </>
          )}
          {agent.destinationLabel && (
            <>
              <Dot />
              <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                To:{" "}
                <span className="text-gray-600 font-medium">{agent.destinationLabel}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoStrip({ logoUrls }: { logoUrls: string[] }) {
  if (logoUrls.length === 0) {
    return <BrandLogo size="sm" />;
  }

  return (
    <div className="flex items-center justify-center gap-4 overflow-x-auto scrollbar-none max-w-[320px]">
      {logoUrls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt="Logo"
          className="h-10 max-h-10 max-w-[160px] w-auto object-contain shrink-0"
        />
      ))}
    </div>
  );
}

function Avatar({ initials, photoUrl, size = "md" }: { initials: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "sm" ? "w-9 h-9 text-xs" :
    size === "lg" ? "w-14 h-14 text-base" :
    "w-12 h-12 text-sm";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt="Photo"
        className={`${cls} rounded-full object-cover shrink-0 ring-2 ring-blue-100`}
      />
    );
  }

  return (
    <div className={`${cls} rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 ring-2 ring-blue-100`}>
      {initials}
    </div>
  );
}

function AgentCardDesktop({
  agent, initials, companyName,
}: {
  agent: AgentProfile;
  initials: string;
  companyName: string | null;
}) {
  return (
    <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5 max-w-[300px]">
      <Avatar initials={initials} photoUrl={agent.photoUrl} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
          {agent.displayName}
        </p>

        {companyName && (
          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{companyName}</span>
          </p>
        )}

        {agent.licenseNumber && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
            <span>Lic. #{agent.licenseNumber}</span>
          </p>
        )}

        {agent.phone && (
          <a
            href={`tel:${agent.phone}`}
            className="text-xs text-gray-500 flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
            {agent.phone}
          </a>
        )}
      </div>
    </div>
  );
}

function AgentCardDrawer({
  agent, initials, companyName, onClose,
}: {
  agent: AgentProfile;
  initials: string;
  companyName: string | null;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials} photoUrl={agent.photoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{agent.displayName}</p>
            {companyName && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{companyName}</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {agent.licenseNumber && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-xs font-medium text-blue-700">Licensed Professional</p>
            <p className="text-xs text-blue-600">License #{agent.licenseNumber}</p>
          </div>
        </div>
      )}

      {(agent.phone || agent.email) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-100">
          {agent.phone && (
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {agent.phone}
            </a>
          )}
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors truncate"
            >
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{agent.email}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const VERIFICATION_BADGE_CONFIG: Record<string, { label: string; className: string } | undefined> = {
  LICENSED: { label: "Licensed Professional", className: "bg-blue-50 text-blue-700 border-blue-200" },
  CERTIFIED: { label: "Certified", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REGULATED: { label: "Regulated", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

function VerificationBadgeInline({ status }: { status: string }) {
  const config = VERIFICATION_BADGE_CONFIG[status];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.className}`}>
      <BadgeCheck className="w-3 h-3 shrink-0" />
      {config.label}
    </span>
  );
}

function VerificationBadgeDrawer({ status }: { status: string }) {
  const config = VERIFICATION_BADGE_CONFIG[status];
  if (!config) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.className}`}>
      <BadgeCheck className="w-4 h-4 shrink-0" />
      <p className="text-xs font-medium">{config.label}</p>
    </div>
  );
}

function TrustPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap shrink-0">
      <Icon className="w-2.5 h-2.5 text-blue-500/70" />
      {label}
    </div>
  );
}

function Dot({ className }: { className?: string }) {
  return <span className={`text-blue-300 select-none shrink-0 ${className ?? ""}`}>·</span>;
}
