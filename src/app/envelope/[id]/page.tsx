"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Signature {
  signatureId: string | null;
  type: string;
  page: number;
  completedAt: string | null;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  status: string;
  completedAt: string | null;
  declinedAt: string | null;
  ipAddress: string | null;
  authMethod: string;
  signatures: Signature[];
}

interface AuditEntry {
  id: string;
  event: string;
  createdAt: string;
  ipAddress: string | null;
}

interface EnvelopeData {
  id: string;
  title: string;
  status: string;
  signingMode: string;
  completedAt: string | null;
  createdAt: string;
  documentHash: string | null;
  signedDocumentHash: string | null;
  agentName: string;
  agencyName: string | null;
  recipients: Recipient[];
  auditLog: AuditEntry[];
}

const EVENT_LABELS: Record<string, string> = {
  DOCUMENT_UPLOADED: "Document uploaded",
  SENT: "Sent to signers",
  OPENED: "Recipient opened link",
  CONSENT: "Recipient gave electronic consent",
  OTP_VERIFIED: "Identity verified via OTP",
  RECIPIENT_SIGNED: "Recipient completed signing",
  COMPLETED: "All parties completed — envelope sealed",
  DECLINED: "Recipient declined",
  VOIDED: "Envelope voided",
  REMINDER_SENT: "Reminder sent",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function fmtShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EnvelopePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [data, setData] = useState<EnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/envelope/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json?.error?.message ?? "Envelope not found.");
        setData(json as EnvelopeData);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load envelope."));
  }, [id]);

  const isCompleted = data?.status === "COMPLETED";
  const allSigIds = data?.recipients.flatMap((r) => r.signatures.map((s) => s.signatureId).filter(Boolean)) ?? [];

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: "480px", width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#450a0a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", marginBottom: "8px" }}>Envelope Not Found</p>
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#020617", borderBottom: "1px solid #1e293b", padding: "16px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "-0.3px", color: "white" }}>
              Secure<span style={{ color: "#3b82f6" }}>Link</span>
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "#475569", fontFamily: "monospace" }}>ENVELOPE VERIFICATION</span>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Verification seal */}
        <div style={{
          borderRadius: "16px",
          border: isCompleted ? "1px solid #166534" : "1px solid #334155",
          background: isCompleted ? "rgba(21,128,61,0.08)" : "rgba(51,65,85,0.3)",
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "16px",
        }}>
          <div style={{
            flexShrink: 0,
            width: "44px", height: "44px", borderRadius: "50%",
            background: isCompleted ? "rgba(21,128,61,0.2)" : "rgba(51,65,85,0.5)",
            border: `1.5px solid ${isCompleted ? "#16a34a" : "#475569"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {isCompleted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: isCompleted ? "#22c55e" : "#94a3b8", marginBottom: "4px" }}>
              {isCompleted ? "Envelope Verified — All Parties Signed" : `Envelope Status: ${data.status}`}
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
              {isCompleted
                ? `Completed ${fmt(data.completedAt)} · Prepared by ${data.agentName}${data.agencyName ? ` · ${data.agencyName}` : ""}`
                : `Created ${fmt(data.createdAt)} · Prepared by ${data.agentName}${data.agencyName ? ` · ${data.agencyName}` : ""}`}
            </p>
            {allSigIds.length > 0 && (
              <p style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>
                {allSigIds.length} signature{allSigIds.length !== 1 ? "s" : ""} attributed: {allSigIds.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Document Info */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "12px" }}>Document</h2>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px 20px", display: "grid", gap: "12px" }}>
            <Row label="Title" value={data.title} />
            <Row label="Envelope ID" value={<span style={{ fontFamily: "monospace", fontSize: "12px", color: "#94a3b8" }}>{data.id}</span>} />
            <Row label="Signing Mode" value={data.signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"} />
            {data.documentHash && (
              <Row label="Original SHA-256" value={
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#64748b", wordBreak: "break-all" }}>{data.documentHash}</span>
              } />
            )}
            {data.signedDocumentHash && (
              <Row label="Signed SHA-256" value={
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#64748b", wordBreak: "break-all" }}>{data.signedDocumentHash}</span>
              } />
            )}
          </div>
        </section>

        {/* Signers */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "12px" }}>Signers</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {data.recipients.map((r) => (
              <div key={r.id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: r.signatures.length > 0 ? "12px" : 0 }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>{r.name}</p>
                    <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{r.email}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                      {r.completedAt && (
                        <Tag color="#166534" bg="rgba(21,128,61,0.12)">Signed {fmtShort(r.completedAt)}</Tag>
                      )}
                      {r.declinedAt && (
                        <Tag color="#991b1b" bg="rgba(153,27,27,0.12)">Declined</Tag>
                      )}
                      {r.ipAddress && (
                        <Tag color="#1e40af" bg="rgba(30,64,175,0.12)">IP {r.ipAddress}</Tag>
                      )}
                      <Tag color="#5b21b6" bg="rgba(91,33,182,0.12)">{r.authMethod}</Tag>
                    </div>
                  </div>
                  <div style={{
                    flexShrink: 0,
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: r.status === "COMPLETED" ? "rgba(21,128,61,0.2)" : r.status === "DECLINED" ? "rgba(153,27,27,0.2)" : "rgba(51,65,85,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {r.status === "COMPLETED" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : r.status === "DECLINED" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    )}
                  </div>
                </div>

                {r.signatures.length > 0 && (
                  <div style={{ borderTop: "1px solid #1e293b", paddingTop: "12px", display: "grid", gap: "8px" }}>
                    {r.signatures.map((s, i) => (
                      <div key={i} style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "#3b82f6", fontFamily: "monospace", letterSpacing: "0.5px" }}>
                            {s.signatureId ?? "Legacy — no ID"}
                          </p>
                          <p style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                            {s.type} · Page {s.page}{s.completedAt ? ` · ${fmt(s.completedAt)}` : ""}
                          </p>
                        </div>
                        {s.signatureId && (
                          <div style={{ flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%", background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Audit Timeline */}
        <section style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "12px" }}>Audit Trail</h2>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden" }}>
            {data.auditLog.map((e, i) => (
              <div key={e.id} style={{
                padding: "12px 20px",
                borderBottom: i < data.auditLog.length - 1 ? "1px solid #1e293b" : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}>
                <div style={{
                  flexShrink: 0, marginTop: "2px",
                  width: "6px", height: "6px", borderRadius: "50%", marginLeft: "2px",
                  background: e.event === "COMPLETED" ? "#22c55e" : e.event === "DECLINED" ? "#f87171" : e.event === "SENT" ? "#3b82f6" : "#475569",
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", color: "#cbd5e1" }}>{EVENT_LABELS[e.event] ?? e.event}</p>
                  <p style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                    {fmt(e.createdAt)}{e.ipAddress ? ` · ${e.ipAddress}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Legal footer */}
        <div style={{ borderTop: "1px solid #1e293b", paddingTop: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#334155", lineHeight: 1.7 }}>
            This verification record was generated by SecureLink (mysecurelink.co) and represents an electronic record under the
            ESIGN Act (15 U.S.C. § 7001) and UETA. The signature IDs above are cryptographically attributed to each signer and
            permanently embedded in the signed PDF document.
          </p>
          <p style={{ fontSize: "10px", color: "#1e293b", marginTop: "8px" }}>
            Envelope ID: {data.id}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: "120px", paddingTop: "1px" }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#cbd5e1", flex: 1 }}>{value}</span>
    </div>
  );
}

function Tag({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
      color, background: bg, border: `1px solid ${color}22`,
    }}>
      {children}
    </span>
  );
}
