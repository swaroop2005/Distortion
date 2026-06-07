/* ThalNet App — Donors list, detail, and Bridge Builder */

function DonorDetail({ donor, onBack }) {
  if (!donor) return null;
  const pct = Math.min(100, Math.round(((donor.eligible ? donor.totalDonations * 90 : (90 - donor.daysUntil)) / 90) * 100));
  const size = 160, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 22px 80px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.soft, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 18, fontFamily: "inherit" }}>
        <Ic n="arrow_back" z={18} col={T.soft} /> All donors
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="tn-two">
        <Card pad={22}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
            <Ava nm={donor.name} sz={56} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{donor.name}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}><GBadge g={donor.group} /></div>
            </div>
          </div>
          {[["Donor ID", donor.id], ["Gender", donor.gender], ["Area", donor.area], ["Phone", donor.phone], ["Total donations", donor.totalDonations], ["Last donated", donor.lastDonated]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: 13.5, color: T.soft }}>{l}</span><span style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "12px", borderRadius: 12, background: T.bg }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.soft, marginBottom: 6 }}>Responsiveness</div>
            <ScoreBar v={donor.responsiveness} col={T.blue} />
          </div>
          <div style={{ marginTop: 10, padding: "12px", borderRadius: 12, background: T.bg }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.soft, marginBottom: 6 }}>Churn risk</div>
            <ScoreBar v={donor.churnRisk} />
          </div>
        </Card>

        <Card pad={22} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, alignSelf: "flex-start" }}>Donation clock</div>
          <div style={{ position: "relative", width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={donor.eligible ? T.green : T.redV} /><stop offset="100%" stopColor={donor.eligible ? "#34D399" : T.red} /></linearGradient></defs>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.line} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#dg)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(pct, 100)) / 100} style={{ transition: "stroke-dashoffset 1.2s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
              {donor.eligible
                ? <div><Ic n="favorite" z={28} fill col={T.green} /><div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: T.green }}>Eligible</div></div>
                : <div><div style={{ fontSize: 36, fontWeight: 800, color: T.redV, letterSpacing: "-.04em", lineHeight: 1 }} className="tnum">{donor.daysUntil}</div><div style={{ fontSize: 12.5, color: T.soft }}>days left</div></div>}
            </div>
          </div>
          <p style={{ fontSize: 14.5, textAlign: "center", color: T.soft, lineHeight: 1.5, marginTop: 18, maxWidth: 260 }}>
            {donor.eligible ? `${donor.name.split(" ")[0]} can donate. Last donated ${donor.lastDonated}.` : `Eligible again on ${donor.eligibleDate}.`}
          </p>
          <button style={{ marginTop: 16, padding: "12px 24px", borderRadius: 99, background: donor.eligible ? T.green : T.line, color: donor.eligible ? "#fff" : T.faint, border: "none", fontSize: 14, fontWeight: 700, cursor: donor.eligible ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {donor.eligible ? "Reserve a slot" : `Available ${donor.eligibleDate}`}
          </button>
        </Card>
      </div>
    </div>
  );
}

function DonorsPage({ setPage, setSelected }) {
  const [search, setSearch] = useSt("");
  const [gFilter, setGFilter] = useSt("all");
  const [eFilter, setEFilter] = useSt("all");
  const donors = window.TNApp.donors;
  const GROUPS = ["all", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
  const filtered = donors.filter(d =>
    (gFilter === "all" || d.group === gFilter) &&
    (eFilter === "all" || (eFilter === "eligible" ? d.eligible : !d.eligible)) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.id.includes(search))
  );
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 22px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>Donors</h1><div style={{ fontSize: 13.5, color: T.soft, marginTop: 3 }}>4,446 enrolled · showing {donors.length} sample</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID…" style={{ padding: "9px 14px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13.5, fontFamily: "inherit", background: T.bg, width: 200 }} />
          <select value={gFilter} onChange={e => setGFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", background: T.bg }}>
            {GROUPS.map(g => <option key={g} value={g}>{g === "all" ? "All groups" : g}</option>)}
          </select>
          <select value={eFilter} onChange={e => setEFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 99, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", background: T.bg }}>
            <option value="all">All eligibility</option><option value="eligible">Eligible now</option><option value="not">Not yet eligible</option>
          </select>
        </div>
      </div>
      <Card pad={0} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead><tr style={{ background: T.bg }}>
            {["Donor","ID","Group","Gender","Eligibility","Responsiveness","Churn risk","Action"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: T.faint, fontSize: 12, letterSpacing: ".05em", textTransform: "uppercase", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={{ borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}
                onClick={() => { setSelected(d); setPage("donor-detail"); }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: 9, alignItems: "center" }}><Ava nm={d.name} sz={32} /><span style={{ fontWeight: 700 }}>{d.name}</span></div></td>
                <td style={{ padding: "12px 16px" }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, color: T.soft }}>{d.id}</span></td>
                <td style={{ padding: "12px 16px" }}><GBadge g={d.group} /></td>
                <td style={{ padding: "12px 16px", color: T.soft }}>{d.gender}</td>
                <td style={{ padding: "12px 16px" }}>{d.eligible ? <span style={{ color: T.green, fontWeight: 700, fontSize: 13 }}>Eligible now</span> : <span style={{ color: T.amber, fontSize: 13 }}>In {d.daysUntil}d</span>}</td>
                <td style={{ padding: "12px 16px" }}><div style={{ width: 100 }}><ScoreBar v={d.responsiveness} col={T.blue} /></div></td>
                <td style={{ padding: "12px 16px" }}><div style={{ width: 100 }}><ScoreBar v={d.churnRisk} /></div></td>
                <td style={{ padding: "12px 16px" }}><button style={{ padding: "6px 13px", borderRadius: 99, background: T.bg, border: `1px solid ${T.line}`, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }} onClick={e => { e.stopPropagation(); setSelected(d); setPage("donor-detail"); }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}`, fontSize: 13, color: T.soft }}>Showing {filtered.length} of 4,446 donors</div>
      </Card>
    </div>
  );
}

/* ---------- Bridge Builder ---------- */
function BridgeBuilder({ patient, onBack }) {
  const [built, setBuilt] = useSt(!!patient && patient.bridge !== "broken");
  const [healing, setHealing] = useSt(false);
  const [healed, setHealed] = useSt(false);
  const [mounted, setMounted] = useSt(false);
  useEf(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const donors = window.TNApp.donors.slice(0, 8).map((d, i) => ({
    ...d,
    status: built ? (i < 2 ? "confirmed" : i < 4 ? "scheduled" : i < 6 ? "contacted" : "resting") : "empty",
  }));

  const spokeCol = { confirmed: T.green, scheduled: T.green, contacted: T.amber, resting: T.line, empty: T.line };
  const nodeCol  = { confirmed: T.green, scheduled: T.green, contacted: T.amber, resting: T.faint, empty: T.line };

  const n = 8, R = 38, cx = 50, cy = 50;
  const nodes = donors.map((d, i) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { ...d, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const integ = built ? (healed ? 95 : patient.bridge === "at-risk" ? 68 : 88) : 0;
  const health = healed ? "full" : patient?.bridge || "full";

  const doHeal = () => {
    setHealing(true);
    setTimeout(() => { setHealing(false); setHealed(true); }, 2200);
  };

  if (!patient) return null;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 22px 80px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.soft, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 18, fontFamily: "inherit" }}>
        <Ic n="arrow_back" z={18} col={T.soft} /> Back
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }}>Blood Bridge · {patient.name}</h1><div style={{ fontSize: 13.5, color: T.soft, marginTop: 4 }}>{patient.group} · {patient.hospital.split(",")[0]}</div></div>
        <div style={{ display: "flex", gap: 9 }}>
          {!built && <button onClick={() => setBuilt(true)} style={{ padding: "11px 22px", borderRadius: 99, background: T.redV, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}><Ic n="hub" z={18} fill col="#fff" />Build bridge (8 donors)</button>}
          {built && patient.bridge !== "full" && !healed && <button onClick={doHeal} disabled={healing} style={{ padding: "11px 22px", borderRadius: 99, background: healing ? T.line : T.amber, color: healing ? T.soft : "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: healing ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}><Ic n={healing ? "autorenew" : "healing"} z={18} fill col={healing ? T.soft : "#fff"} />{healing ? "Healing…" : "Heal bridge"}</button>}
          {healed && <span style={{ padding: "11px 22px", borderRadius: 99, background: T.greenSoft, color: T.green, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}><Ic n="check_circle" z={18} fill col={T.green} />Bridge healed</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", gap: 18 }} className="tn-two">
        <Card pad={24}>
          {/* SVG bridge diagram */}
          <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", aspectRatio: "1/1" }}>
            <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, overflow: "visible", width: "100%", height: "100%" }}>
              <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.line} strokeWidth={0.5} strokeDasharray="2 2" />
              {nodes.map((d, i) => (
                <line key={i} x1={cx} y1={cy} x2={d.x} y2={d.y}
                  stroke={spokeCol[d.status]} strokeWidth={d.status === "confirmed" ? 1.2 : 0.7}
                  strokeLinecap="round" strokeDasharray={d.status === "empty" ? "1.5 2" : d.status === "contacted" ? "2 1.5" : "none"}
                  opacity={built ? 1 : 0.2}
                  style={{ transition: "opacity .5s, stroke .5s" }} />
              ))}
            </svg>

            {/* center node */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 3 }}>
              <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto" }}>
                {healed && <span style={{ position: "absolute", inset: -8, borderRadius: 99, border: `2px solid ${T.green}`, animation: "pulse 2s infinite", opacity: .5 }} />}
                <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={50} cy={50} r={40} fill="none" stroke={T.line} strokeWidth={10} />
                  <circle cx={50} cy={50} r={40} fill="none" stroke={health === "broken" ? T.red : health === "at-risk" ? T.amber : T.green} strokeWidth={10}
                    strokeLinecap="round" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * integ) / 100}
                    style={{ transition: "stroke-dashoffset 1.2s ease, stroke .6s" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }} className="tnum">{integ}</div><div style={{ fontSize: 9.5, color: T.soft, fontWeight: 700, letterSpacing: ".06em" }}>INTEGRITY</div></div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 13 }}>{patient.name.split(" ")[0]}</div>
              <GBadge g={patient.group} style={{ marginTop: 4 }} />
            </div>

            {/* donor nodes */}
            {nodes.map(d => (
              <div key={d.id} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, transform: `translate(-50%,-50%) scale(${mounted && built ? 1 : 0.4})`, opacity: mounted && built ? 1 : 0, transition: "all .45s cubic-bezier(.2,.9,.3,1.3)", transitionDelay: `${0.1 + nodes.indexOf(d) * 0.07}s`, zIndex: 2, textAlign: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: 99, margin: "0 auto", background: "#fff", border: `2.5px solid ${nodeCol[d.status]}`, boxShadow: "0 2px 8px rgba(0,0,0,.1)", overflow: "hidden", display: "grid", placeItems: "center" }}>
                  {d.status === "empty" ? <Ic n="person_add" z={18} col={T.faint} /> : <Ava nm={d.name} sz={38} />}
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 3, color: T.soft, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name?.split(" ")[0]}</div>
              </div>
            ))}
          </div>

          {/* legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", marginTop: 14 }}>
            {[["confirmed","Confirmed"],["contacted","Contacted"],["resting","Resting"],["empty","Open slot"]].map(([k,l]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.soft }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: nodeCol[k] }} />{l}
              </div>
            ))}
          </div>
        </Card>

        {/* donor list */}
        <Card pad={18}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Bridge donors</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nodes.map((d, i) => (
              <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 11, background: T.bg, border: `1px solid ${T.line}` }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: nodeCol[d.status], flexShrink: 0 }} />
                {built ? <Ava nm={d.name} sz={30} /> : <div style={{ width: 30, height: 30, borderRadius: 99, background: T.line }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{built ? d.name : `Slot ${i + 1}`}</div>
                  <div style={{ fontSize: 11.5, color: T.soft }}>{built ? `${d.group} · ${d.area}` : "—"}</div>
                </div>
                {built && <GBadge g={d.group} />}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { DonorsPage, DonorDetail, BridgeBuilder });
