/* ThalNet App — Dashboard page */

function BloodGroupChart({ data }) {
  const canvasRef = useRf(null);
  const chartRef = useRf(null);
  useEf(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.group),
        datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => GRP_COL[d.group] || "#999"), borderWidth: 2, borderColor: "#fff", hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "68%",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString("en-IN")} donors` } } },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);

  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
        <canvas ref={canvasRef} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em" }}>{total.toLocaleString("en-IN")}</div><div style={{ fontSize: 11.5, color: T.soft }}>donors</div></div>
        </div>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
        {data.map(d => (
          <div key={d.group} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: GRP_COL[d.group], flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: T.ink, minWidth: 32 }}>{d.group}</span>
            <span style={{ fontSize: 12, color: T.soft, fontVariantNumeric: "tabular-nums" }}>{d.count.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BridgeHealthPanel({ data }) {
  const total = data.bridgesTotal || data.bridgesFull + data.bridgesAtRisk + data.bridgesBroken;
  const segs = [
    { k: "full",     n: data.bridgesFull,    col: T.green, label: "Full" },
    { k: "at-risk",  n: data.bridgesAtRisk,  col: T.amber, label: "At risk" },
    { k: "broken",   n: data.bridgesBroken,  col: T.red,   label: "Broken" },
  ];
  return (
    <div>
      <div style={{ height: 12, borderRadius: 99, background: T.line, display: "flex", overflow: "hidden", marginBottom: 14 }}>
        {segs.map(s => <div key={s.k} style={{ width: `${(s.n / total) * 100}%`, background: s.col, transition: "width 1s ease" }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {segs.map(s => (
          <div key={s.k} style={{ background: s.k === "broken" ? T.redSoft : s.k === "at-risk" ? T.amberSoft : T.greenSoft, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.k === "broken" ? "#FECACA" : s.k === "at-risk" ? "#FDE68A" : "#A7F3D0"}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", color: s.col }}>{s.n}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: s.col, marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: T.soft, marginTop: 2 }}>{Math.round((s.n / total) * 100)}% of bridges</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ setPage, setSelected }) {
  const d = window.TNApp.dashboard;
  const STATS = [
    { v: d.totalDonors.toLocaleString("en-IN"), l: "Total donors", sub: `${d.eligibleDonors.toLocaleString("en-IN")} eligible now`, i: "volunteer_activism", col: T.green },
    { v: d.totalPatients, l: "Patients", sub: "active in network", i: "favorite", col: T.red },
    { v: d.eligibleDonors.toLocaleString("en-IN"), l: "Eligible right now", sub: "can donate today", i: "check_circle", col: T.green },
    { v: d.highChurn, l: "High churn risk", sub: "need attention", i: "warning", col: T.amber },
    { v: d.totalBridges, l: "Blood bridges", sub: `${d.bridgesFull} full · ${d.bridgesBroken} broken`, i: "hub", col: T.blue },
    { v: "73%", l: "Response rate", sub: "last 30 days", i: "forum", col: T.green },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 22px 80px" }}>
      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>Dashboard</h1>
        <div style={{ fontSize: 13.5, color: T.soft, marginTop: 3 }}>Hyderabad Region · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }} className="tn-stat-grid">
        {STATS.map((s, i) => (
          <Card key={i} pad={18}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <Ic n={s.i} z={20} fill col={s.col} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", color: s.col, lineHeight: 1 }} className="tnum">{s.v}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginTop: 5 }}>{s.l}</div>
            <div style={{ fontSize: 11.5, color: T.soft, marginTop: 1 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* charts + bridge */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 16, marginBottom: 16 }} className="tn-two">
        <Card pad={22}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Blood group distribution</div>
          <BloodGroupChart data={d.bloodDist} />
        </Card>
        <Card pad={22}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Bridge health · {d.totalBridges} total</div>
          <BridgeHealthPanel data={d} />
        </Card>
      </div>

      {/* alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="tn-two">
        {/* urgent patients */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Urgent transfusions</div>
            <button onClick={() => setPage("patients")} style={{ background: "none", border: "none", color: T.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View all</button>
          </div>
          <div>
            {d.urgentPatients.map(p => (
              <div key={p.id} onClick={() => { setSelected(p); setPage("patient-detail"); }} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: T.red, animation: "pulse 2s infinite", flexShrink: 0 }} />
                <Ava nm={p.name} sz={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.soft }}>{p.hospital.split(",")[0]}</div>
                </div>
                <GBadge g={p.group} />
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.red }}>{p.nextTx}</div>
                  <div style={{ fontSize: 11.5, color: T.soft }}>{p.daysToTx}d away</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* churn alerts */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>High churn risk donors</div>
            <button onClick={() => setPage("donors")} style={{ background: "none", border: "none", color: T.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View all</button>
          </div>
          <div>
            {d.churnDonors.map(don => (
              <div key={don.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${T.line}` }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Ava nm={don.name} sz={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{don.name}</div>
                  <div style={{ fontSize: 12, color: T.soft }}>{don.area}</div>
                </div>
                <GBadge g={don.group} />
                <div style={{ width: 80, flexShrink: 0 }}>
                  <ScoreBar v={don.churnRisk} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
