/* ThalNet Blood Bridge — Radial Layout (Simplified & Clean)
   Patient at center, 8 donors in circle around. One line style (thin, color-coded by status).
   No integrity score number — replaced with progress ring. No floating labels. */

function BloodBridge({ patient, donors, compact }) {
  const [activeNode, setActiveNode] = useState(null);
  
  // Color tokens
  const T = {
    red: "#e63148",
    green: "#17b26a",
    amber: "#f5a524",
    gray: "#d1d5db",
    red50: "#fef2f2",
    green50: "#ecfdf5",
    amber50: "#fffbeb",
    gray50: "#f9fafb",
    ink: "#16202c",
    muted: "#6b7a8d",
    line: "#e3e9f0",
    white: "#ffffff",
  };

  // Status styling
  const statusStyle = {
    confirmed: { border: T.green, fill: T.green50, dashArray: "none", solid: true },
    scheduled: { border: T.green, fill: T.white, dashArray: "none", solid: true },
    awaiting: { border: T.amber, fill: T.amber50, dashArray: "4 2", solid: false, pulse: true },
    resting: { border: T.gray, fill: T.gray50, dashArray: "4 2", solid: false },
    lapsed: { border: T.red, fill: T.red50, dashArray: "4 2", solid: false },
    empty: { border: T.gray, fill: T.white, dashArray: "2 3", solid: false },
  };

  // Count statuses
  const confirmed = donors.filter(d => d.status === "confirmed" || d.status === "scheduled").length;
  const awaiting = donors.filter(d => d.status === "awaiting").length;
  const lapsed = donors.filter(d => d.status === "lapsed").length;
  const open = donors.filter(d => d.status === "empty").length;

  const initials = (name) => name ? name.split(" ").map(w => w[0]).join("").slice(0, 2) : "?";

  // SVG radial layout
  const sz = compact ? 280 : 380;
  const cx = sz / 2;
  const cy = sz / 2;
  const patientR = compact ? 30 : 40;
  const donorR = compact ? 22 : 28;
  const ringRadius = compact ? 85 : 120;

  // Calculate donor positions (evenly spaced around circle)
  const donorPositions = donors.map((d, i) => {
    const angle = (i * 360 / donors.length - 90) * (Math.PI / 180);
    return {
      x: cx + ringRadius * Math.cos(angle),
      y: cy + ringRadius * Math.sin(angle),
    };
  });

  // Progress ring (completeness indicator)
  const progress = (confirmed / patient.bridge.target) * 100;
  const ringCircumference = 2 * Math.PI * (patientR + 8);
  const ringOffset = ringCircumference - (ringCircumference * progress) / 100;

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: ".05em", color: T.ink, textTransform: "uppercase" }}>
          The Blood Bridge
        </div>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 8,
          background: T.green50,
          color: T.green,
          fontSize: 12,
          fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
          Self-healing
        </div>
      </div>

      {/* SVG Radial Map */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <svg width={sz} height={sz} style={{ maxWidth: "100%" }}>
          {/* Connection lines: patient to each donor */}
          {donors.map((donor, i) => {
            const pos = donorPositions[i];
            const style = statusStyle[donor.status] || statusStyle.resting;
            return (
              <line
                key={`line-${i}`}
                x1={cx}
                y1={cy}
                x2={pos.x}
                y2={pos.y}
                stroke={style.border}
                strokeWidth={compact ? 1.2 : 1.5}
                strokeDasharray={style.dashArray}
                opacity={0.6}
              />
            );
          })}

          {/* Patient node (center) */}
          <g>
            {/* Breathing halo around patient */}
            <circle
              cx={cx}
              cy={cy}
              r={patientR + 16}
              fill="none"
              stroke={T.red}
              strokeWidth={1}
              opacity={0.2}
              style={{
                animation: "breathe 3s ease-in-out infinite",
              }}
            />

            {/* Progress ring */}
            <circle
              cx={cx}
              cy={cy}
              r={patientR + 8}
              fill="none"
              stroke={T.line}
              strokeWidth={2}
              opacity={0.3}
            />
            <circle
              cx={cx}
              cy={cy}
              r={patientR + 8}
              fill="none"
              stroke={T.green}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              style={{ transition: "stroke-dashoffset .6s ease" }}
              transform={`rotate(-90 ${cx} ${cy})`}
            />

            {/* Patient circle */}
            <circle cx={cx} cy={cy} r={patientR} fill={T.white} stroke={T.red} strokeWidth={3} />
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fontSize={compact ? 18 : 24}
              fontWeight={800}
              fill={T.ink}
            >
              {initials(patient.name)}
            </text>
          </g>

          {/* Donor nodes */}
          {donors.map((donor, i) => {
            const pos = donorPositions[i];
            const style = statusStyle[donor.status] || statusStyle.resting;
            const isEmpty = donor.status === "empty";

            return (
              <g key={`donor-${i}`}>
                {/* Pulse animation for awaiting */}
                {style.pulse && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={donorR + 6}
                    fill="none"
                    stroke={style.border}
                    strokeWidth={1}
                    opacity={0}
                    style={{
                      animation: "pulse-ring 2s cubic-bezier(.4,0,.6,1) infinite",
                    }}
                  />
                )}

                {/* Donor circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={donorR}
                  fill={style.fill}
                  stroke={style.border}
                  strokeWidth={2}
                  style={{ cursor: isEmpty ? "default" : "pointer" }}
                  onClick={() => !isEmpty && setActiveNode(activeNode === i ? null : i)}
                />

                {/* Donor initials or + icon */}
                {isEmpty ? (
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={600}
                    fill={T.muted}
                    style={{ pointerEvents: "none" }}
                  >
                    +
                  </text>
                ) : (
                  <text
                    x={pos.x}
                    y={pos.y + 6}
                    textAnchor="middle"
                    fontSize={compact ? 12 : 14}
                    fontWeight={800}
                    fill={T.ink}
                    opacity={0.7}
                    style={{ pointerEvents: "none" }}
                  >
                    {initials(donor.name)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Donor labels below SVG */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${compact ? 3 : 4}, 1fr)`,
        gap: 10,
        marginBottom: 16,
        fontSize: 11,
        textAlign: "center",
      }}>
        {donors.map((donor, i) => (
          <div key={`label-${i}`} style={{ color: T.muted }}>
            {donor.status === "empty" ? "Open" : donor.name.split(" ")[0]}
          </div>
        ))}
      </div>

      {/* Status summary pills */}
      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 12,
        fontSize: 12,
        fontWeight: 600,
      }}>
        <span style={{ color: T.green }}>● {confirmed} Confirmed</span>
        {awaiting > 0 && <span style={{ color: T.amber }}>● {awaiting} Awaiting</span>}
        {lapsed > 0 && <span style={{ color: T.red }}>● {lapsed} Lapsed</span>}
        {open > 0 && <span style={{ color: T.muted }}>● {open} Open</span>}
      </div>

      {/* Bridge health banner */}
      {lapsed > 0 ? (
        <div style={{
          background: T.amber50,
          border: `1px solid ${T.amber}`,
          color: T.amber,
          padding: "10px 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>Bridge needs attention — {lapsed} donor lapsed</span>
          <button style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${T.amber}`,
            background: "transparent",
            color: T.amber,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            Self-heal
          </button>
        </div>
      ) : confirmed === patient.bridge.target ? (
        <div style={{
          background: T.green50,
          border: `1px solid ${T.green}`,
          color: T.green,
          padding: "10px 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          textAlign: "center",
        }}>
          Bridge is complete
        </div>
      ) : (
        <div style={{
          color: T.muted,
          padding: "10px 12px",
          textAlign: "center",
          fontSize: 12,
        }}>
          Finding donors…
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "center",
        marginTop: 12,
        fontSize: 11,
        color: T.muted,
        borderTop: `1px solid ${T.line}`,
        paddingTop: 12,
      }}>
        {[
          { k: "confirmed", l: "Confirmed", c: T.green },
          { k: "scheduled", l: "Scheduled", c: T.green },
          { k: "awaiting", l: "Awaiting reply", c: T.amber },
          { k: "resting", l: "Resting", c: T.gray },
          { k: "lapsed", l: "Lapsed", c: T.red },
          { k: "empty", l: "Open slot", c: T.muted },
        ].map((item) => (
          <div key={item.k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: item.c,
                opacity: 0.7,
              }}
            />
            {item.l}
          </div>
        ))}
      </div>

      {/* Popover for clicked node */}
      {activeNode !== null && !donors[activeNode]?.status === "empty" && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: T.white,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>
            {donors[activeNode].name}
          </div>
          <div style={{ color: T.muted, marginBottom: 6 }}>
            {donors[activeNode].group} · Donated {donors[activeNode].donationCount || 1}× before
          </div>
          {donors[activeNode].nextEligible && (
            <div style={{ color: T.muted, marginBottom: 6 }}>
              Eligible: {donors[activeNode].nextEligible}
            </div>
          )}
          {donors[activeNode].status === "lapsed" && (
            <button style={{
              width: "100%",
              marginTop: 8,
              padding: "6px",
              borderRadius: 6,
              border: `1px solid ${T.red}`,
              background: "transparent",
              color: T.red,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Self-heal
            </button>
          )}
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes breathe {
          0%, 100% {
            r: ${compact ? 34 : 48}px;
            opacity: 0.15;
          }
          50% {
            r: ${compact ? 40 : 56}px;
            opacity: 0.05;
          }
        }
        @keyframes pulse-ring {
          0% {
            stroke-width: 1px;
            opacity: 1;
            r: ${compact ? 24 : 32}px;
          }
          100% {
            stroke-width: 0px;
            opacity: 0;
            r: ${compact ? 36 : 50}px;
          }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { BloodBridge });
