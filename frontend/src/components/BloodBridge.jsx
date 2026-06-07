import { useState } from 'react';

const STATUS_STYLE = {
  confirmed: { border:"#17b26a", fill:"#ecfdf5", dashArray:"none", pulse:false },
  scheduled: { border:"#17b26a", fill:"#fff",    dashArray:"none", pulse:false },
  awaiting:  { border:"#f5a524", fill:"#fffbeb", dashArray:"4 2",  pulse:true  },
  contacted: { border:"#f5a524", fill:"#fffbeb", dashArray:"4 2",  pulse:true  },
  resting:   { border:"#d1d5db", fill:"#f9fafb", dashArray:"4 2",  pulse:false },
  lapsed:    { border:"#e63148", fill:"#fef2f2", dashArray:"4 2",  pulse:false },
  empty:     { border:"#d1d5db", fill:"#fff",    dashArray:"2 3",  pulse:false },
};

const ini = name => name ? name.split(" ").map(w => w[0]).join("").slice(0,2) : "?";

export default function BloodBridge({ patient, donors, compact }) {
  const [activeNode, setActiveNode] = useState(null);

  const sz = compact ? 280 : 360;
  const cx = sz / 2, cy = sz / 2;
  const patientR  = compact ? 30 : 38;
  const donorR    = compact ? 22 : 26;
  const ringRadius = compact ? 88 : 118;

  const confirmed = donors.filter(d => d.status === "confirmed" || d.status === "scheduled").length;
  const awaiting  = donors.filter(d => d.status === "awaiting"  || d.status === "contacted").length;
  const lapsed    = donors.filter(d => d.status === "lapsed").length;
  const open      = donors.filter(d => d.status === "empty").length;

  const positions = donors.map((_, i) => {
    const angle = (i * 360 / donors.length - 90) * (Math.PI / 180);
    return { x: cx + ringRadius * Math.cos(angle), y: cy + ringRadius * Math.sin(angle) };
  });

  const pct = (confirmed / (patient.bridge?.target || 8)) * 100;
  const ringC = 2 * Math.PI * (patientR + 8);
  const ringOff = ringC - (ringC * pct) / 100;

  return (
    <div style={{ width:"100%" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid var(--line)" }}>
        <div style={{ fontSize:13, fontWeight:800, letterSpacing:".06em", color:"var(--ink)", textTransform:"uppercase", fontFamily:"var(--ff-mono)" }}>The Blood Bridge</div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 11px", borderRadius:999, background:"var(--green-50)", color:"var(--green-600)", fontSize:12, fontWeight:600 }}>
          <span style={{ width:7, height:7, borderRadius:99, background:"var(--green-500)" }} /> Self-healing
        </div>
      </div>

      {/* SVG Radial */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
        <svg width={sz} height={sz} style={{ maxWidth:"100%" }}>
          {/* connection lines */}
          {donors.map((donor, i) => {
            const pos = positions[i];
            const s = STATUS_STYLE[donor.status] || STATUS_STYLE.resting;
            return <line key={i} x1={cx} y1={cy} x2={pos.x} y2={pos.y} stroke={s.border} strokeWidth={compact?1.2:1.5} strokeDasharray={s.dashArray} opacity={0.55} />;
          })}

          {/* patient center */}
          <g>
            <circle cx={cx} cy={cy} r={patientR+16} fill="none" stroke="#e63148" strokeWidth={1} opacity={0.15} />
            <circle cx={cx} cy={cy} r={patientR+8} fill="none" stroke="var(--line)" strokeWidth={2} opacity={0.3} />
            <circle cx={cx} cy={cy} r={patientR+8} fill="none" stroke="var(--green-500)" strokeWidth={2}
              strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringOff}
              style={{ transition:"stroke-dashoffset .6s ease" }} transform={`rotate(-90 ${cx} ${cy})`} />
            <circle cx={cx} cy={cy} r={patientR} fill="#fff" stroke="#e63148" strokeWidth={3} />
            <text x={cx} y={cy+8} textAnchor="middle" fontSize={compact?17:22} fontWeight={800} fill="var(--ink)">{ini(patient.name)}</text>
          </g>

          {/* donor nodes */}
          {donors.map((donor, i) => {
            const pos = positions[i];
            const s = STATUS_STYLE[donor.status] || STATUS_STYLE.resting;
            return (
              <g key={i}>
                {s.pulse && (
                  <circle cx={pos.x} cy={pos.y} r={donorR+6} fill="none" stroke={s.border} strokeWidth={1} opacity={0} style={{ animation:"pulse-ring 2s cubic-bezier(.4,0,.6,1) infinite" }} />
                )}
                <circle cx={pos.x} cy={pos.y} r={donorR} fill={s.fill} stroke={s.border} strokeWidth={2}
                  style={{ cursor: donor.status === "empty" ? "default" : "pointer" }}
                  onClick={() => donor.status !== "empty" && setActiveNode(activeNode === i ? null : i)} />
                {donor.status === "empty"
                  ? <text x={pos.x} y={pos.y+5} textAnchor="middle" fontSize={15} fontWeight={500} fill="var(--muted)">+</text>
                  : <text x={pos.x} y={pos.y+6} textAnchor="middle" fontSize={compact?11:13} fontWeight={800} fill="var(--ink)" opacity={0.75}>{ini(donor.name)}</text>
                }
              </g>
            );
          })}
        </svg>
      </div>

      {/* Donor name labels */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${compact?3:4},1fr)`, gap:8, marginBottom:14, textAlign:"center", fontSize:11, color:"var(--muted)" }}>
        {donors.map((d,i) => <div key={i}>{d.status==="empty" ? "Open" : (d.name||"").split(" ")[0]}</div>)}
      </div>

      {/* Status summary */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center", marginBottom:12, fontSize:12.5, fontWeight:600 }}>
        <span style={{ color:"var(--green-600)" }}>● {confirmed} Confirmed</span>
        {awaiting > 0 && <span style={{ color:"var(--amber-600)" }}>● {awaiting} Awaiting</span>}
        {lapsed > 0   && <span style={{ color:"var(--red-500)" }}>● {lapsed} Lapsed</span>}
        {open > 0     && <span style={{ color:"var(--muted)" }}>● {open} Open</span>}
      </div>

      {/* Bridge health banner */}
      {lapsed > 0 ? (
        <div style={{ background:"var(--amber-50)", border:"1px solid var(--amber-100)", color:"var(--amber-600)", padding:"10px 14px", borderRadius:10, fontSize:12.5, fontWeight:600, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Bridge needs attention — {lapsed} donor{lapsed>1?"s":""} lapsed</span>
          <span style={{ fontSize:11, fontWeight:600, color:"var(--amber-600)" }}>ThalNet self-healing</span>
        </div>
      ) : confirmed >= (patient.bridge?.target||8) ? (
        <div style={{ background:"var(--green-50)", border:"1px solid var(--green-100)", color:"var(--green-600)", padding:"10px 14px", borderRadius:10, fontSize:12.5, fontWeight:600, textAlign:"center" }}>
          Bridge is complete ✓
        </div>
      ) : (
        <div style={{ color:"var(--muted)", padding:"10px 14px", textAlign:"center", fontSize:12.5 }}>Finding donors…</div>
      )}

      {/* Clicked node popover */}
      {activeNode !== null && donors[activeNode] && donors[activeNode].status !== "empty" && (
        <div style={{ marginTop:14, padding:14, background:"#fff", border:"1px solid var(--line)", borderRadius:10, fontSize:13 }}>
          <div style={{ fontWeight:700, color:"var(--ink)", marginBottom:4 }}>{donors[activeNode].name}</div>
          <div style={{ color:"var(--muted)", marginBottom:2 }}>{donors[activeNode].group} · {donors[activeNode].km}km away</div>
          {donors[activeNode].note && <div style={{ color:"var(--muted)", fontSize:12 }}>{donors[activeNode].note}</div>}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center", marginTop:14, fontSize:11, color:"var(--muted)", borderTop:"1px solid var(--line)", paddingTop:12 }}>
        {[["confirmed","#17b26a","Confirmed"],["awaiting","#f5a524","Awaiting reply"],["resting","#d1d5db","Resting"],["lapsed","#e63148","Lapsed"],["empty","var(--muted)","Open slot"]].map(([k,c,l]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7, height:7, borderRadius:99, background:c, opacity:0.8 }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}
