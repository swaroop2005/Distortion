/* ThalNet App — Patient Map page with Leaflet */

function MapPage() {
  const mapRef = useRf(null);
  const mapInst = useRf(null);
  const layersRef = useRf({ patients: [], donors: [], banks: [] });
  const [filter, setFilter] = useSt({ group: "all", district: "all", show: { patients: true, donors: true, banks: true } });
  const [stats, setStats] = useSt({ donors: 0, banks: 0, patients: 0 });
  const [selected, setSelected] = useSt(null);

  const { patients, donors, banks } = window.TNApp;

  // Create custom div icons
  const makeIcon = (col, symbol, sz = 10) => L.divIcon({
    className: "",
    html: `<div style="width:${sz+6}px;height:${sz+6}px;border-radius:50%;background:${col};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center;font-size:${sz*0.7}px;color:white;font-weight:700">${symbol}</div>`,
    iconSize: [sz + 6, sz + 6],
    iconAnchor: [(sz + 6) / 2, (sz + 6) / 2],
    popupAnchor: [0, -(sz + 6) / 2],
  });

  useEf(() => {
    if (!mapRef.current || mapInst.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([17.385, 78.4867], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  // Add/update markers when filter changes
  useEf(() => {
    const map = mapInst.current;
    if (!map) return;

    // clear old layers
    Object.values(layersRef.current).flat().forEach(l => map.removeLayer(l));
    layersRef.current = { patients: [], donors: [], banks: [] };

    const grp = filter.group;
    let pCount = 0, dCount = 0, bCount = 0;

    if (filter.show.patients) {
      const filtered = grp === "all" ? patients : patients.filter(p => p.group === grp);
      pCount = filtered.length;
      filtered.forEach(p => {
        const m = L.marker([p.lat, p.lng], { icon: makeIcon(T.red, "P", 12) }).addTo(map);
        m.bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:2px;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.name}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
              <span style="background:${GRP_BG[p.group]};color:${GRP_COL[p.group]};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${p.group}</span>
              <span style="font-size:12px;color:#6B7280">${p.area}</span>
            </div>
            <div style="font-size:12px;color:#374151">Next transfusion: <b>${p.nextTx}</b></div>
            <div style="font-size:12px;color:#374151;margin-top:2px">Bridge: <b style="color:${p.bridge==="broken"?T.red:p.bridge==="at-risk"?T.amber:T.green}">${p.bridge}</b></div>
            <div style="font-size:11px;color:#9CA3AF;margin-top:4px">${p.hospital}</div>
          </div>`);
        m.on("click", () => setSelected({ type: "patient", data: p }));
        layersRef.current.patients.push(m);
      });
    }

    if (filter.show.donors) {
      const filtered = grp === "all" ? donors : donors.filter(d => d.group === grp);
      dCount = filtered.length;
      filtered.forEach(d => {
        const col = d.eligible ? T.blue : "#93C5FD";
        const m = L.marker([d.lat, d.lng], { icon: makeIcon(col, "D", 10) }).addTo(map);
        m.bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:2px;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${d.name}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
              <span style="background:${GRP_BG[d.group]};color:${GRP_COL[d.group]};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${d.group}</span>
              <span style="font-size:12px;color:${d.eligible?T.green:T.amber};font-weight:600">${d.eligible?"Eligible":"In ${d.daysUntil}d"}</span>
            </div>
            <div style="font-size:12px;color:#374151">Responsiveness: <b>${Math.round(d.responsiveness*100)}%</b></div>
            <div style="font-size:11px;color:#9CA3AF;margin-top:4px">${d.area}</div>
          </div>`);
        layersRef.current.donors.push(m);
      });
    }

    if (filter.show.banks) {
      const filtered = grp === "all" ? banks : banks.filter(b => b.group === grp || true);
      bCount = filtered.length;
      filtered.forEach(b => {
        const col = b.units > 80 ? T.green : b.units > 30 ? T.amber : T.red;
        const m = L.marker([b.lat, b.lng], { icon: makeIcon(col, "B", 11) }).addTo(map);
        m.bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:2px;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:2px">${b.name}</div>
            <div style="font-size:12px;color:#6B7280;margin-bottom:6px">${b.district} · ${b.type}</div>
            <div style="font-size:12px;color:#374151">Stock: <b style="color:${col}">${b.units} units</b></div>
            <div style="font-size:12px;color:#374151;margin-top:2px">Status: <b style="color:${b.open?T.green:T.red}">${b.open?"Open":"Closed"}</b></div>
            <div style="font-size:11.5px;color:#9CA3AF;margin-top:4px">${b.phone}</div>
          </div>`);
        layersRef.current.banks.push(m);
      });
    }

    setStats({ patients: pCount, donors: dCount, banks: bCount });
  }, [filter]);

  const GROUPS = ["all", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

  return (
    <div style={{ position: "relative", height: "calc(100vh - 58px)", overflow: "hidden" }}>
      {/* map container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* left sidebar overlay */}
      <div style={{ position: "absolute", left: 12, top: 12, bottom: 12, width: 280, background: "rgba(255,255,255,.96)", backdropFilter: "blur(8px)", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.12)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${T.line}` }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Map filters</div>

          {/* blood group */}
          <label style={{ fontSize: 12, fontWeight: 700, color: T.soft, letterSpacing: ".04em", textTransform: "uppercase" }}>Blood group</label>
          <select value={filter.group} onChange={e => setFilter(f => ({ ...f, group: e.target.value }))} style={{ width: "100%", marginTop: 5, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13.5, fontFamily: "inherit", background: T.bg, color: T.ink }}>
            {GROUPS.map(g => <option key={g} value={g}>{g === "all" ? "All groups" : g}</option>)}
          </select>
        </div>

        {/* layer toggles */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.soft, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 8 }}>Show on map</div>
          {[
            { k: "patients", l: "Patients", col: T.red, sym: "P" },
            { k: "donors",   l: "Donors",   col: T.blue, sym: "D" },
            { k: "banks",    l: "Blood banks", col: T.green, sym: "B" },
          ].map(layer => (
            <label key={layer.k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={filter.show[layer.k]} onChange={e => setFilter(f => ({ ...f, show: { ...f.show, [layer.k]: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: T.redV }} />
              <div style={{ width: 20, height: 20, borderRadius: 99, background: layer.col, display: "grid", placeItems: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>{layer.sym}</div>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{layer.l}</span>
            </label>
          ))}
        </div>

        {/* stats */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.soft, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 10 }}>Results</div>
          {[
            { l: "Patients shown", v: stats.patients, col: T.red },
            { l: "Donors shown",   v: stats.donors,   col: T.blue },
            { l: "Blood banks",    v: stats.banks,     col: T.green },
          ].map(s => (
            <div key={s.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: 13, color: T.soft }}>{s.l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: s.col }} className="tnum">{s.v}</span>
            </div>
          ))}
        </div>

        {/* legend */}
        <div style={{ padding: "12px 16px", flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.soft, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 10 }}>Legend</div>
          {[
            { col: T.red,   l: "Patient" },
            { col: T.blue,  l: "Eligible donor" },
            { col: "#93C5FD", l: "Ineligible donor" },
            { col: T.green, l: "Bank · good stock" },
            { col: T.amber, l: "Bank · low stock" },
            { col: T.red,   l: "Bank · critical" },
          ].map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 99, background: l.col, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: T.soft }}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* selected popup detail */}
      {selected && (
        <div style={{ position: "absolute", right: 12, top: 12, width: 260, background: "#fff", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,.14)", zIndex: 100, border: `1px solid ${T.line}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", background: T.redSoft, borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.type === "patient" ? "Patient" : "Donor"}</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Ic n="close" z={18} col={T.soft} /></button>
          </div>
          {selected.type === "patient" && (
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.data.name}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}><GBadge g={selected.data.group} /><StatusBdg v={selected.data.bridge} /></div>
              <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: T.soft }}>
                <div>Next transfusion: <b style={{ color: T.ink }}>{selected.data.nextTx}</b></div>
                <div>Donors: <b style={{ color: T.ink }}>{selected.data.confirmed}/{selected.data.needed} confirmed</b></div>
                <div style={{ marginTop: 4 }}>{selected.data.hospital}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { MapPage });
