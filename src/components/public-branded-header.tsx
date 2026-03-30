interface AgentBranding {
  displayName: string;
  agencyName?: string | null;
  company?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
}

export function PublicBrandedHeader({ agent }: { agent: AgentBranding }) {
  const initials = agent.displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header style={{
      background: "white",
      borderBottom: "1px solid #e2e8f0",
      padding: "12px 20px",
    }}>
      <div style={{
        maxWidth: "680px",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        {/* Left spacer to balance layout */}
        <div style={{ width: "40px" }} />

        {/* Center: logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {agent.logoUrl ? (
            <img
              src={agent.logoUrl}
              alt={agent.agencyName ?? agent.displayName}
              style={{ height: "36px", maxWidth: "160px", objectFit: "contain" }}
            />
          ) : (
            <span style={{
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              color: "#0f172a",
            }}>
              Secure<span style={{ color: "#3b82f6" }}>Link</span>
            </span>
          )}
          {(agent.agencyName || agent.company) && (
            <span style={{ fontSize: "11px", color: "#94a3b8", letterSpacing: "0.05em" }}>
              {agent.agencyName ?? agent.company}
            </span>
          )}
        </div>

        {/* Right: agent photo / avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          {agent.photoUrl ? (
            <img
              src={agent.photoUrl}
              alt={agent.displayName}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #e2e8f0",
              }}
            />
          ) : (
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <span style={{ fontSize: "10px", color: "#94a3b8", maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
            {agent.displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
