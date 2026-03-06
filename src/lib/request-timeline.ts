import { Download, Eye, Plus, Send, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

export type TimelineEvent = {
  id: string;
  label: string;
  sublabel?: string;
  time: Date;
  iconBg: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SKIP_EVENTS = new Set(["LINK_SENT"]);

const AUDIT_CONFIG: Record<string, Omit<TimelineEvent, "id" | "time" | "sublabel">> = {
  LINK_CREATED: { label: "Request created", icon: Plus, iconBg: "bg-slate-100", iconColor: "text-slate-500" },
  LINK_OPENED: { label: "Opened by client", icon: Eye, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  SSN_OPENED: { label: "Opened by client", icon: Eye, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  SUBMITTED: { label: "Form submitted", icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  SSN_SUBMITTED: { label: "SSN submitted", icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  REVEALED: { label: "Data revealed by agent", icon: Eye, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  SSN_REVEALED: { label: "SSN revealed by agent", icon: Eye, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  EXPORTED: { label: "Data exported", icon: Download, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  EXPIRED: { label: "Link expired", icon: AlertCircle, iconBg: "bg-red-100", iconColor: "text-red-500" },
  DELETED: { label: "Submission deleted", icon: Trash2, iconBg: "bg-red-100", iconColor: "text-red-500" },
};

export function buildRequestTimeline(
  auditLogs: { id: string; event: string; createdAt: Date }[],
  sends: { id: string; method: string; recipient: string; createdAt: Date }[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const log of auditLogs) {
    if (SKIP_EVENTS.has(log.event)) continue;
    const cfg = AUDIT_CONFIG[log.event];
    if (!cfg) continue;
    events.push({ id: `audit-${log.id}`, ...cfg, time: log.createdAt });
  }

  for (const send of sends) {
    events.push({
      id: `send-${send.id}`,
      label: `Sent via ${send.method === "SMS" ? "SMS" : send.method === "EMAIL" ? "email" : "link copy"}`,
      sublabel: send.recipient !== "clipboard" ? `To: ${send.recipient}` : undefined,
      time: send.createdAt,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      icon: Send,
    });
  }

  return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
