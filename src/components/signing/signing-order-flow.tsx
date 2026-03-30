"use client";

import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";

interface FlowRecipient {
  id: string;
  name: string;
  email: string;
  order: number;
  status: "PENDING" | "OPENED" | "COMPLETED" | "DECLINED";
  completedAt: string | null;
  isAgent?: boolean;
}

interface SigningOrderFlowProps {
  signingMode: "PARALLEL" | "SEQUENTIAL" | string;
  recipients: FlowRecipient[];
}

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#e0f2fe", text: "#0369a1" },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function SigningOrderFlow({ signingMode, recipients }: SigningOrderFlowProps) {
  const sorted = [...recipients].sort((a, b) => a.order - b.order);
  const isSequential = signingMode === "SEQUENTIAL";

  // Active signer in sequential = first non-COMPLETED non-DECLINED
  const activeId = isSequential
    ? (sorted.find((r) => r.status === "PENDING" || r.status === "OPENED")?.id ?? null)
    : null;

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Signing Flow
        </span>
        <span style={{
          fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
          background: isSequential ? "#f0f9ff" : "#f0fdf4",
          color: isSequential ? "#0369a1" : "#15803d",
        }}>
          {isSequential ? "Sequential" : "Parallel"}
        </span>
      </div>

      {!isSequential && (
        <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "10px" }}>
          All signers can sign simultaneously in any order.
        </p>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: "0", flexWrap: "wrap" }}>
        {sorted.map((r, idx) => {
          const isActive = activeId === r.id;
          const colors = AVATAR_COLORS[idx % AVATAR_COLORS.length];

          let borderColor = "#e2e8f0";
          let bgColor = "white";
          let statusIcon = null;
          let statusLabel = "Waiting";
          let statusColor = "#94a3b8";

          if (r.status === "COMPLETED") {
            borderColor = "#10b981";
            bgColor = "#f0fdf4";
            statusIcon = <CheckCircle2 style={{ width: "12px", height: "12px", color: "#10b981", flexShrink: 0 }} />;
            statusLabel = "Signed";
            statusColor = "#059669";
          } else if (r.status === "DECLINED") {
            borderColor = "#ef4444";
            bgColor = "#fef2f2";
            statusIcon = <XCircle style={{ width: "12px", height: "12px", color: "#ef4444", flexShrink: 0 }} />;
            statusLabel = "Declined";
            statusColor = "#dc2626";
          } else if (r.status === "OPENED") {
            borderColor = "#3b82f6";
            bgColor = "#eff6ff";
            statusIcon = <Clock style={{ width: "12px", height: "12px", color: "#3b82f6", flexShrink: 0 }} />;
            statusLabel = "In Progress";
            statusColor = "#2563eb";
          } else if (isActive) {
            borderColor = "#3b82f6";
            bgColor = "#eff6ff";
            statusLabel = "Up Next";
            statusColor = "#2563eb";
          }

          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: "12px",
                  background: bgColor,
                  padding: "10px 12px",
                  minWidth: "130px",
                  maxWidth: "170px",
                  animation: isActive && r.status === "PENDING" ? "sc-pulse 2s ease-in-out infinite" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  {isSequential && (
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", minWidth: "14px" }}>
                      {idx + 1}
                    </span>
                  )}
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: colors.bg, color: colors.text,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: 800, flexShrink: 0,
                  }}>
                    {getInitials(r.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>
                      {r.name}
                      {r.isAgent && (
                        <span style={{ fontSize: "9px", fontWeight: 700, marginLeft: "4px", color: "#7c3aed", background: "#ede9fe", borderRadius: "4px", padding: "0 4px" }}>
                          Agent
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", paddingLeft: isSequential ? "22px" : "0" }}>
                  {statusIcon}
                  <span style={{ fontSize: "10px", fontWeight: 600, color: statusColor }}>{statusLabel}</span>
                </div>
                {r.status === "COMPLETED" && r.completedAt && (
                  <p style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px", paddingLeft: isSequential ? "22px" : "0" }}>
                    {fmtDate(r.completedAt)}
                  </p>
                )}
              </div>
              {isSequential && idx < sorted.length - 1 && (
                <ArrowRight style={{ width: "16px", height: "16px", color: "#cbd5e1", margin: "0 4px", flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes sc-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); } 50% { box-shadow: 0 0 0 4px rgba(59,130,246,0); } }`}</style>
    </div>
  );
}
