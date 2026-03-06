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
  photoUrl?: string | null;
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
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm">

      <div className="hidden sm:block">
        <div className="max-w-screen-md mx-auto px-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 gap-6">
            <div />
            <LogoStrip logoUrls={logoUrls} />
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

      <div className="sm:hidden relative flex items-center h-14 px-4">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-14">
          <LogoStrip logoUrls={logoUrls} />
        </div>
        <button
          onClick={() => setAgentOpen((v) => !v)}
          className="ml-auto relative z-10 flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-expanded={agentOpen}
          aria-label="View agent details"
        >
          <Avatar initials={initials} photoUrl={agent.photoUrl} size="sm" />
          {verification && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${agentOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {agentOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl px-4 py-4 shadow-lg">
          <AgentCardDrawer
            agent={agent}
            initials={initials}
            verification={verification}
            companyLine={companyLine}
            onClose={() => setAgentOpen(false)}
          />
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/80">
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
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                Submitted to:{" "}
                <span className="text-gray-700 font-medium">{agent.destinationLabel}</span>
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
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
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

function Avatar({ initials, photoUrl, size = "md" }: { initials: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "sm" ? "w-7 h-7 text-xs" :
    size === "lg" ? "w-11 h-11 text-base" :
    "w-9 h-9 text-sm";

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt="Agent photo"
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
  agent, initials, verification, companyLine,
}: {
  agent: AgentProfile;
  initials: string;
  verification: { label: string; cls: string } | undefined;
  companyLine: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 max-w-[260px]">
      <Avatar initials={initials} photoUrl={agent.photoUrl} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
          {agent.displayName}
        </p>

        {companyLine && (
          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{companyLine}</span>
          </p>
        )}

        {verification && (
          <div className="pt-0.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border leading-none ${verification.cls}`}>
              <BadgeCheck className="w-2.5 h-2.5" />
              {verification.label}
            </span>
          </div>
        )}

        {agent.licenseNumber && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-gray-400 font-bold text-[10px]">#</span>
            License {agent.licenseNumber}
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

        {agent.email && (
          <a
            href={`mailto:${agent.email}`}
            className="text-xs text-gray-500 flex items-center gap-1 hover:text-blue-600 transition-colors truncate max-w-full"
          >
            <Mail className="w-3 h-3 text-gray-400 shrink-0" />
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials} photoUrl={agent.photoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{agent.displayName}</p>
            {companyLine && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="truncate">{companyLine}</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
          aria-label="Close agent details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {verification && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${verification.cls}`}>
            <BadgeCheck className="w-3.5 h-3.5" />
            {verification.label}
          </span>
        )}
        {agent.licenseNumber && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            # License {agent.licenseNumber}
          </span>
        )}
      </div>

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

function TrustPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap shrink-0">
      <Icon className="w-2.5 h-2.5 text-blue-500/70" />
      {label}
    </div>
  );
}

function Divider() {
  return <span className="text-gray-300 select-none shrink-0">·</span>;
}
