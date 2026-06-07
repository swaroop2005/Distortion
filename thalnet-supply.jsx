/* ThalNet App — Supply Chain page */

function SupplyPage() {
  const { supply } = window.TNApp;
  const stockCol = { ok: T.green, watch: T.amber, low: T.amber, critical: T.red };
  const stockBg  = { ok: T.greenSoft, watch: T.amberSoft, low: T.amberSoft, critical: T.redSoft };
  const [activeTab, setActiveTab] = useSt("stock");
  const tabs = [
    { k: "stock",  l: "Regional stock" },
    { k: "banks",  l: "Blood banks" },
    { k: "mobilize", l: "Mobilization queue" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 22px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>Supply Chain</h1>
        <div style={{ fontSize: 13.5, color: T.soft, marginTop: 3 }}>Telangana · 3,863 banks tracked</div>
      </div>

      {/* shortage alerts */}
      {supply.regional.filter(r => r.status === "critical" || r.status === "low").map(r => (
        <div key={r.group} style={{ display: "flex", gap: 11, alignItems: "center", padding: "12px 16px", borderRadius: 12, background: r.status === "critical" ? T.redSoft : T.amberSoft, border: `1px solid ${r.status === "critical" ? "#FECACA" : "#FDE68A"}`, marginBottom: 10 }}>
          <Ic n={r.status === "critical" ? "emergency" : "warning"} z={20} fill col={stockCol[r.status]} />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>
            <b style={{ fontFamily: "'IBM Plex Mono',monospace", color: stockCol[r.status] }}>{r.group}</b> stock {r.status} — {r.units} units remaining.
            {r.status === "critical" && " ThalNet is pre-mobilising donors now."}
          </div>
          <button style={{ padding: "6px 14px", borderRadius: 99, background: stockCol[r.status], color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Act</button>
        </div>
      ))}

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: 4, marginBottom: 18, width: "fit-content" }}>
        {tabs.map(t => <button key={t.k} onClick={() => setActiveTab(t.k)} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: activeTab === t.k ? "#fff" : "transparent", color: activeTab === t.k ? T.ink : T.soft, fontWeight: activeTab === t.k ? 700 : 500, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", boxShadow: activeTab === t.k ? "0 1px 4px rgba(0,0,0,.08)" : "none", transition: "all .15s" }}>{t.l}</button>)}
      </div>

      {/* regional stock */}
      {activeTab === "stock" && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Regional blood stock · Telangana</div>
            <div style={{ fontSize: 12.5, color: T.soft, marginTop: 2 }}>Real-time aggregation across all registered banks</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
            {supply.regional.map((r, i) => {
              const pct = Math.round((r.units / r.capacity) * 100);
              const c = stockCol[r.status], bg = stockBg[r.status];
              return (
                <div key={r.group} style={{ padding: "20px 22px", borderBottom: i < supply.regional.length - 3 ? `1px solid ${T.line}` : "none", borderRight: (i + 1) % 3 !== 0 ? `1px solid ${T.line}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 800, fontSize: 18, color: T.ink }}>{r.group}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: "-.03em", marginTop: 2 }} className="tnum">{r.units}</div>
                      <div style={{ fontSize: 12, color: T.soft }}>of {r.capacity} capacity</div>
                    </div>
                    <span style={{ padding: "4px 10px", borderRadius: 99, background: bg, color: c, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{r.status}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: T.line, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: c, borderRadius: 99, transition: "width 1s ease" }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 5 }}>{pct}% capacity</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* banks list */}
      {activeTab === "banks" && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Blood banks · Hyderabad</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ background: T.bg }}>
              {["Bank","District","Type","Group","Stock","Phone","Status"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: T.faint, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {window.TNApp.banks.map((b, i) => {
                const sc = b.units > 80 ? T.green : b.units > 30 ? T.amber : T.red;
                return (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${T.line}`, background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}>
                    <td style={{ padding: "12px 16px" }}><div style={{ fontWeight: 700 }}>{b.name}</div></td>
                    <td style={{ padding: "12px 16px", color: T.soft }}>{b.district}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 9px", borderRadius: 99, background: T.bg, color: T.soft, fontSize: 12, fontWeight: 600, border: `1px solid ${T.line}` }}>{b.type}</span></td>
                    <td style={{ padding: "12px 16px" }}><GBadge g={b.group} /></td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 700, color: sc }} className="tnum">{b.units}</span> <span style={{ color: T.faint, fontSize: 12 }}>units</span></td>
                    <td style={{ padding: "12px 16px", color: T.soft, fontSize: 12.5 }}>{b.phone}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: b.open ? T.green : T.faint }}><span style={{ width: 7, height: 7, borderRadius: 99, background: b.open ? T.green : T.faint }} />{b.open ? "Open" : "Closed"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* mobilization queue */}
      {activeTab === "mobilize" && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>Mobilization queue</div><div style={{ fontSize: 12.5, color: T.soft, marginTop: 2 }}>Donors being contacted to fill supply gaps</div></div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99, background: T.greenSoft, color: T.green, fontSize: 12.5, fontWeight: 700 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: T.green, animation: "pulse 2s infinite" }} />Agent running</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ background: T.bg }}>
              {["Donor","Group","Priority","Status","Bridge / reason"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: T.faint, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {supply.mobilization.map((m, i) => (
                <tr key={m.did} style={{ borderBottom: `1px solid ${T.line}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Ava nm={m.name} sz={32} /><div><div style={{ fontWeight: 700 }}>{m.name}</div><div style={{ fontSize: 11.5, color: T.faint }}>{m.did}</div></div></div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><GBadge g={m.group} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: T.line, overflow: "hidden", minWidth: 60 }}><div style={{ width: (m.priority * 100) + "%", height: "100%", background: m.priority > 0.7 ? T.red : T.amber, borderRadius: 99 }} /></div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.priority > 0.7 ? T.red : T.amber, minWidth: 30 }} className="tnum">{Math.round(m.priority * 100)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><StatusBdg v={m.status} /></td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: T.soft, maxWidth: 240 }}>{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

Object.assign(window, { SupplyPage });
