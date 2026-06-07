/* ThalNet App — Patients list + detail view */

function PatientDetail({ patient, onBack, onBridge }) {
  if (!patient) return null;
  const hc = { full: T.green, "at-risk": T.amber, broken: T.red }[patient.bridge] || T.soft;
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 22px 80px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.soft, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 18, fontFamily: "inherit" }}>
        <Ic n="arrow_back" z={18} col={T.soft} /> All patients
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }} className="tn-two">
        <Card pad={22}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
            <Ava nm={patient.name} sz={56} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{patient.name}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}><GBadge g={patient.group} /><StatusBdg v={patient.bridge} /></div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["Patient ID", patient.id], ["Age", patient.age + " years"], ["Gender", patient.gender],
              ["Area", patient.area], ["Next transfusion", patient.nextTx],
              ["Days to transfusion", patient.daysToTx + " days"], ["Phase", patient.phase],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
                <span style={{ fontSize: 13.5, color: T.soft }}>{l}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card pad={22}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Bridge status</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: patient.bridge === "broken" ? T.redSoft : patient.bridge === "at-risk" ? T.amberSoft : T.greenSoft, marginBottom: 14 }}>
              <Ic n={patient.bridge === "broken" ? "cancel" : patient.bridge === "at-risk" ? "warning" : "check_circle"} z={28} fill col={hc} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: hc }}>Bridge {patient.bridge}</div>
                <div style={{ fontSize: 13, color: T.soft, marginTop: 2 }}>{patient.confirmed} of {patient.needed} donors confirmed</div>
              </div>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: T.line, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${(patient.confirmed / patient.needed) * 100}%`, height: "100%", background: hc, borderRadius: 99, transition: "width 1s ease" }} />
            </div>
            <div style={{ fontSize: 12.5, color: T.soft, textAlign: "right" }}>{patient.confirmed}/{patient.needed} donors</div>
          </Card>
          <Card pad={22} style={{ background: T.warm }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 8 }}>{patient.hospital}</div>
            <div style={{ fontSize: 13.5, color: T.soft, lineHeight: 1.5 }}>{patient.area}, Hyderabad, Telangana</div>
          </Card>
          <button onClick={() => onBridge(patient)} style={{ padding: "14px", borderRadius: 12, background: T.redV, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
            <Ic n="hub" z={20} fill col="#fff" /> {patient.bridge === "broken" ? "Heal bridge" : "View / build bridge"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientsPage({ setPage, setSelected }) {
  const [search, setSearch] = useSt("");
  const [gFilter, setGFilter] = useSt("all");
  const [bFilter, setBFilter] = useSt("all");
  const [sortBy, setSortBy] = useSt("daysToTx");
  const patients = window.TNApp.patients;
  const GROUPS = ["all", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

  const filtered = patients
    .filter(p => (gFilter === "all" || p.group === gFilter) && (bFilter === "all" || p.bridge === bFilter) && (p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)))
    .sort((a, b) => sortBy === "daysToTx" ? a.daysToTx - b.daysToTx : sortBy === "name" ? a.name.localeCompare(b.name) : 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 22px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>Patients</h1><div style={{ fontSize: 13.5, color: T.soft, marginTop: 3 }}>{patients.length} patients · Hyderabad region</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID…" style={{ padding: "9px 14px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13.5, fontFamily: "inherit", background: T.bg, width: 200 }} />
          <select value={gFilter} onChange={e => setGFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", background: T.bg }}>
            {GROUPS.map(g => <option key={g} value={g}>{g === "all" ? "All groups" : g}</option>)}
          </select>
          <select value={bFilter} onChange={e => setBFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", background: T.bg }}>
            <option value="all">All bridges</option><option value="full">Full</option><option value="at-risk">At risk</option><option value="broken">Broken</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "9px 12px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", background: T.bg }}>
            <option value="daysToTx">Sort: Next Tx</option><option value="name">Sort: Name</option>
          </select>
        </div>
      </div>
      <Card pad={0} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead><tr style={{ background: T.bg }}>
            {["Patient","ID","Group","Age","Bridge","Next Tx","Hospital","Action"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: T.faint, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}
                onClick={() => { setSelected(p); setPage("patient-detail"); }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: 9, alignItems: "center" }}><Ava nm={p.name} sz={32} /><span style={{ fontWeight: 700 }}>{p.name}</span></div></td>
                <td style={{ padding: "12px 16px" }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, color: T.soft }}>{p.id}</span></td>
                <td style={{ padding: "12px 16px" }}><GBadge g={p.group} /></td>
                <td style={{ padding: "12px 16px", color: T.soft }}>{p.age}</td>
                <td style={{ padding: "12px 16px" }}><StatusBdg v={p.bridge} /></td>
                <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 600, color: p.daysToTx <= 7 ? T.red : T.ink }}>{p.nextTx}</span></td>
                <td style={{ padding: "12px 16px", color: T.soft, fontSize: 12.5, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.hospital.split(",")[0]}</td>
                <td style={{ padding: "12px 16px" }}><StatusBdg v={p.phase} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}`, fontSize: 13, color: T.soft }}>Showing {filtered.length} of {patients.length} patients</div>
      </Card>
    </div>
  );
}

Object.assign(window, { PatientsPage, PatientDetail });
