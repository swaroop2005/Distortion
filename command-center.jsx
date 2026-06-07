/* Blood Supply Command Center — Telangana regional view with API calls */

const { useState, useEffect, useRef } = React;

function CommandCenter() {
  const [scenario, setScenario] = useState("baseline");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch from API on mount + scenario change
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    // Mock data for Command Center
    const mockData = {
      baseline: {
        criticalGroups: 0,
        firstShortageDay: 4.8,
        unitsToRedistribute: 3005,
        donorsToMobilize: 3669,
        banksSupplying: 235,
        bloodGroupSupply: [
          { group: "O+", units: 1240, days: 8.5 },
          { group: "O-", units: 320, days: 5.2 },
          { group: "A+", units: 980, units: 7.2 },
          { group: "A-", units: 180, days: 4.1 },
          { group: "B+", units: 750, days: 6.8 },
          { group: "B-", units: 120, days: 3.5 },
          { group: "AB+", units: 420, days: 5.9 },
          { group: "AB-", units: 90, days: 2.8 },
        ],
        districts: [
          { name: "Hyderabad", supply: 2800, demand: 2100, status: "green", lat: 17.3850, lng: 78.4867 },
          { name: "Rangareddy", supply: 1200, demand: 950, status: "green", lat: 17.4239, lng: 78.5922 },
          { name: "Medchal", supply: 600, demand: 750, status: "red", lat: 17.4747, lng: 78.6449 },
          { name: "Nalgonda", supply: 850, demand: 1200, status: "amber", lat: 17.0516, lng: 79.1297 },
          { name: "Yadadri", supply: 450, demand: 600, status: "red", lat: 17.2701, lng: 78.9361 },
        ],
        transfers: [
          { from: "Apollo Hospitals, Hyderabad", to: "NIMS, Hyderabad", group: "O+", units: 120, km: 8 },
          { from: "CARE Hospitals, Hyderabad", to: "Medicover, Rangareddy", group: "B+", units: 85, km: 25 },
          { from: "Yashoda Hospitals, Hyderabad", to: "Star Hospitals, Medchal", group: "A+", units: 150, km: 35 },
        ],
        donorMobilization: [
          { group: "O+", donors: 890 },
          { group: "A+", donors: 620 },
          { group: "B+", donors: 540 },
          { group: "AB+", donors: 280 },
          { group: "O-", donors: 180 },
          { group: "A-", donors: 120 },
          { group: "B-", donors: 45 },
          { group: "AB-", donors: 14 },
        ],
      },
      moderate: {
        criticalGroups: 1,
        firstShortageDay: 2.3,
        unitsToRedistribute: 5120,
        donorsToMobilize: 6800,
        banksSupplying: 235,
        bloodGroupSupply: [
          { group: "O+", units: 620, days: 4.2 },
          { group: "O-", units: 160, days: 2.6 },
          { group: "A+", units: 490, days: 3.6 },
          { group: "A-", units: 90, days: 2.0 },
          { group: "B+", units: 375, days: 3.4 },
          { group: "B-", units: 60, days: 1.8 },
          { group: "AB+", units: 210, days: 2.9 },
          { group: "AB-", units: 45, days: 1.4 },
        ],
      },
      surge: {
        criticalGroups: 3,
        firstShortageDay: 0.8,
        unitsToRedistribute: 12500,
        donorsToMobilize: 14200,
        banksSupplying: 235,
        bloodGroupSupply: [
          { group: "O+", units: 200, days: 1.4 },
          { group: "O-", units: 50, days: 0.8 },
          { group: "A+", units: 160, days: 1.2 },
          { group: "A-", units: 30, days: 0.6 },
          { group: "B+", units: 125, days: 1.1 },
          { group: "B-", units: 20, days: 0.5 },
          { group: "AB+", units: 70, days: 1.0 },
          { group: "AB-", units: 15, days: 0.4 },
        ],
      },
    };
    
    setTimeout(() => {
      setData(mockData[scenario] || mockData.baseline);
      setLoading(false);
    }, 300);
  }, [scenario]);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: T.soft }}>Loading supply data...</div>;
  if (error) return <div style={{ padding: "40px", color: T.red }}>Error: {error}</div>;
  if (!data) return null;

  const kpis = [
    { v: data.criticalGroups || 0, l: "Critical groups", col: data.criticalGroups > 0 ? T.red : T.green },
    { v: (data.firstShortageDay || 4.8) + "d", l: "First shortage", col: T.amber },
    { v: data.unitsToRedistribute || 3005, l: "Units to redistribute", col: T.ink },
    { v: data.donorsToMobilize || 3669, l: "Donors to mobilize", col: T.amber },
    { v: data.banksSupplying || 235, l: "Banks supplying", col: T.green },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* header */}
      <div style={{
        background: "linear-gradient(100deg, #0a2540, #13355c)",
        color: "#fff",
        padding: "20px 26px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.redV, display: "grid", placeItems: "center" }}>
            <Ic n="water_drop" z={18} fill col="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Blood Supply Command Center</div>
            <div style={{ fontSize: 12, color: "#aebfd4", marginTop: 2 }}>Blood Warriors · as of {new Date().toLocaleDateString("en-IN")} · 30-day horizon</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: "auto" }}>
          {/* scope toggle (India/Telangana) — Telangana only for now */}
          <div style={{ display: "flex", gap: 0, background: "#0e2a4a", border: "1px solid #2b517d", borderRadius: 9, padding: 3 }}>
            <button style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "transparent", color: "#aebfd4", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🇮🇳 India</button>
            <button style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: T.redV, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📍 Telangana</button>
          </div>

          {/* scenario dropdown */}
          <select value={scenario} onChange={e => setScenario(e.target.value)} style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid #2b517d", background: "#0e2a4a",
            color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
          }}>
            <option value="baseline">Current sample (baseline)</option>
            <option value="moderate">Moderate load (10×)</option>
            <option value="surge">Peak surge (30×)</option>
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ padding: "20px 26px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }} className="cc-kpi-grid">
        {kpis.map((k, i) => (
          <Card key={i} pad={18} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 25, fontWeight: 750, color: k.col, letterSpacing: "-.03em", lineHeight: 1 }} className="tnum">{k.v}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.soft, letterSpacing: ".04em", textTransform: "uppercase", marginTop: 8 }}>{k.l}</div>
          </Card>
        ))}
      </div>

      {/* info bar */}
      <div style={{ margin: "14px 26px 0", padding: "12px 16px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", fontSize: 12 }}>
        {scenario === "baseline" && "Telangana supply snapshot — current patient demand (47 bridges, 84 patients). Map shows district coverage status."}
        {scenario === "moderate" && "Moderate scenario: patient demand projected 10× current (480 patients). Supply rebalance required."}
        {scenario === "surge" && "Peak surge: 30× baseline demand (2,520 patients). Emergency protocol: all-bank mobilization + inter-state transfers."}
      </div>

      {/* main 2-col grid */}
      <div style={{ padding: "16px 26px", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16 }} className="cc-main-grid">
        {/* left: chart */}
        <Card pad={20} style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}`, paddingBottom: 12, marginBottom: 14 }}>Coverage by blood group — days of supply</div>
          <SupplyChart data={data.supplyByGroup || []} />
        </Card>

        {/* right: map */}
        <Card pad={0} style={{ overflow: "hidden", borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: ".05em", textTransform: "uppercase", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>Telangana district supply & demand</div>
          <CommandCenterMap districts={data.districts || []} />
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.soft, display: "flex", gap: 12 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 99, background: T.red }} />Shortfall</div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 99, background: T.amber }} />Received</div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 99, background: T.green }} />Covered</div>
          </div>
        </Card>
      </div>

      {/* bottom 2-col grid */}
      <div style={{ padding: "0 26px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }} className="cc-bottom-grid">
        {/* transfers table */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: ".05em", textTransform: "uppercase", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>Recommended bank→bank transfers</div>
          <TransfersTable transfers={data.transfers || []} />
        </Card>

        {/* donor mobilization chart */}
        <Card pad={20} style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}`, paddingBottom: 12, marginBottom: 14 }}>Donor mobilization → ThalNet</div>
          <DonorMobilizationChart data={data.donorsByGroup || []} />
          <div style={{ fontSize: 11.5, color: T.soft, marginTop: 12, fontStyle: "italic" }}>
            {(data.donorsToMobilize || 3669).toLocaleString("en-IN")} eligible donors selected (nearest-first) for ThalNet
          </div>
        </Card>
      </div>

      {/* footer */}
      <div style={{ textAlign: "center", fontSize: 11.5, color: T.soft, padding: "20px" }}>
        Generated {new Date().toLocaleDateString("en-IN")} {new Date().toLocaleTimeString("en-IN")} · supply: live e-RaktKosh scrape · demand: patient transfusion schedules · red-cell components · prototype
      </div>
    </div>
  );
}

/* Supply chart — horizontal bars per blood group */
function SupplyChart({ data }) {
  const groups = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
  const maxDays = 60;
  const rows = groups.map(g => {
    const d = data.find(x => x.group === g) || { group: g, daysOfSupply: 0, status: "critical" };
    const col = d.status === "critical" ? T.red : d.status === "low" ? T.amber : T.green;
    return { ...d, col };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map(r => (
        <div key={r.group} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, width: 35, fontSize: 13 }}>{r.group}</div>
          <div style={{ flex: 1, height: 8, borderRadius: 99, background: T.line, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((r.daysOfSupply || 0) / maxDays, 1) * 100}%`, height: "100%", background: r.col, borderRadius: 99, transition: "width .6s" }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 13, width: 35, textAlign: "right", color: r.col }} className="tnum">{r.daysOfSupply || 0}d</div>
        </div>
      ))}
    </div>
  );
}

/* Command Center map */
function CommandCenterMap({ districts }) {
  const mapRef = useRf(null);
  const mapInst = useRf(null);

  useEf(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current).setView([17.9, 79.2], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© CARTO",
      maxZoom: 18,
    }).addTo(map);
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  useEf(() => {
    const map = mapInst.current;
    if (!map || !districts.length) return;
    districts.forEach(d => {
      const col = d.status === "shortfall" ? T.red : d.status === "received" ? T.amber : T.green;
      const sz = Math.sqrt(d.demand) * 2;
      const marker = L.circleMarker([d.lat, d.lng], {
        radius: Math.max(8, Math.min(sz, 20)),
        fillColor: col,
        color: "#fff",
        weight: 2.5,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;min-width:160px">
          <b>${d.name}</b><br/>
          Supply: <span style="color:${col};font-weight:700">${d.supply} units</span><br/>
          Demand: ${d.demand} units<br/>
          Incoming: ${d.incoming} units
        </div>
      `);
    });
  }, [districts]);

  return <div ref={mapRef} style={{ height: 430, width: "100%", borderRadius: 12 }} />;
}

/* Transfers table */
function TransfersTable({ transfers }) {
  return (
    <div style={{ maxHeight: 340, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: T.bg }}>
            {["From bank", "To bank", "Grp", "Units", "km"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: T.soft, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transfers.map((t, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
              <td style={{ padding: "11px 12px" }}>
                <div style={{ fontWeight: 700 }}>{t.fromBank}</div>
                <div style={{ fontSize: 11, color: T.soft }}>{t.fromDistrict} · {t.fromType}</div>
              </td>
              <td style={{ padding: "11px 12px" }}>
                <div style={{ fontWeight: 700 }}>{t.toBank}</div>
                <div style={{ fontSize: 11, color: T.soft }}>{t.toDistrict}</div>
              </td>
              <td style={{ padding: "11px 12px" }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: T.ink }}>{t.group}</span></td>
              <td style={{ padding: "11px 12px", textAlign: "right" }}><span className="tnum" style={{ fontWeight: 700 }}>{t.units}</span></td>
              <td style={{ padding: "11px 12px", textAlign: "right" }}><span className="tnum" style={{ fontSize: 12, color: T.soft }}>{t.km}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Donor mobilization chart */
function DonorMobilizationChart({ data }) {
  const canvasRef = useRf(null);
  const chartRef = useRf(null);
  useEf(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: data.map(d => d.group),
        datasets: [{
          data: data.map(d => d.donors),
          backgroundColor: T.redV,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 12, weight: 600 } } },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);
  return <canvas ref={canvasRef} style={{ height: 200 }} />;
}

Object.assign(window, { CommandCenter });
