/* ThalNet — Admin / Coordinator operations center. Data-dense, calm, in-control.
   Bridge board, churn alerts w/ recommended actions, agent feed, supply intelligence. */

function AdminStat({ icon, value, label, tone, sub }) {
  return (
    <Card pad={18} style={{ flex: "1 1 170px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", color: tone || "var(--ink)" }}>{value}</div>
        <Icon name={icon} size={22} color={tone || "var(--faint)"} />
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function IntegrityBar({ value, health }) {
  const hc = HEALTH[health];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 99, background: "var(--line)", overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${value}%`, height: "100%", background: hc.dot, borderRadius: 99, transition: "width 1s ease" }} />
      </div>
      <span className="tnum mono" style={{ fontSize: 12.5, fontWeight: 600, color: hc.fg, width: 26, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const ACTIONS = {
  contact:    { label: "Contact now", icon: "call", variant: "primary" },
  wait:       { label: "Wait", icon: "schedule", variant: "ghost" },
  appreciate: { label: "Send thanks", icon: "favorite", variant: "green" },
  dnd:        { label: "Do not disturb", icon: "do_not_disturb_on", variant: "ghost" },
};

function AdminView() {
  const { adminStats: s, bridges, churnAlerts, agentFeed, supply } = window.TN;
  const [alerts, setAlerts] = useState(churnAlerts);
  const [done, setDone] = useState({});
  const resolve = (id) => setDone(d => ({ ...d, [id]: true }));

  const stockColor = { ok: "var(--green-500)", watch: "var(--amber-500)", low: "var(--amber-600)", critical: "var(--red-500)" };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 22px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }}>Operations</h1>
          <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 3 }}>Hyderabad region · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <Badge tone="green" dot>Agents running</Badge>
          <Button variant="ghost" size="sm" icon="open_in_new">Supply Command Center</Button>
        </div>
      </div>

      {/* stat row */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <AdminStat icon="emergency" value={s.activeRequests} label="Active requests" tone="var(--red-500)" sub="3 urgent" />
        <AdminStat icon="hub" value={s.bridgesTotal} label="Blood bridges" sub={`${s.bridgesFull} full · ${s.bridgesAtRisk} at risk · ${s.bridgesBroken} broken`} />
        <AdminStat icon="groups" value={s.donorPool.toLocaleString("en-IN")} label="Donor pool" tone="var(--green-600)" sub={`${s.donorsActive} active`} />
        <AdminStat icon="forum" value={`${s.confirmedToday}/${s.outreachToday}`} label="Confirmed / outreach today" />
        <AdminStat icon="priority_high" value={s.escalations} label="Escalations" tone="var(--amber-600)" sub="need a human" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18 }} className="ad-grid">
        {/* LEFT: bridge board + supply */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* bridge health board */}
          <Card pad={22}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <Eyebrow color="var(--muted)">Bridge health board</Eyebrow>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", marginTop: 5 }}>Every patient bridge at a glance</div>
              </div>
              <Button variant="ghost" size="sm" iconRight="expand_more">All 47</Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {bridges.map(b => (
                <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.9fr auto", gap: 12, alignItems: "center", padding: "12px 10px", borderRadius: 12, transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <Avatar name={b.patient} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.patient}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{b.group} · {b.area}</div>
                    </div>
                  </div>
                  <IntegrityBar value={b.integrity} health={b.health} />
                  <div style={{ fontSize: 12.5 }}>
                    <span className="mono tnum" style={{ fontWeight: 700 }}>{b.confirmed}/{b.target}</span>
                    <span style={{ color: "var(--faint)" }}> donors</span>
                    {b.flag && <div style={{ fontSize: 11.5, color: b.health === "broken" ? "var(--red-500)" : "var(--amber-600)", marginTop: 1, fontWeight: 600 }}>{b.flag}</div>}
                  </div>
                  <StatusBadge status={b.health} map={HEALTH} />
                </div>
              ))}
            </div>
          </Card>

          {/* supply intelligence */}
          <Card pad={22}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <Eyebrow color="var(--muted)">Supply intelligence</Eyebrow>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", marginTop: 5 }}>Regional blood stock</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--faint)" }} className="mono">
                {supply.nationalBanks.toLocaleString("en-IN")} banks<br/>{supply.stockRows.toLocaleString("en-IN")} stock rows
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }} className="ad-stock">
              {supply.regional.map(g => (
                <div key={g.group} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>{g.group}</div>
                  <div className="tnum" style={{ fontSize: 22, fontWeight: 800, color: stockColor[g.status], marginTop: 2 }}>{g.units}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: stockColor[g.status], textTransform: "uppercase", marginTop: 2 }} className="mono">{g.status}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "13px 15px", borderRadius: 12, background: "var(--red-50)", border: "1px solid var(--red-100)", display: "flex", gap: 11, alignItems: "flex-start" }}>
              <Icon name="trending_down" size={20} color="var(--red-500)" style={{ marginTop: 1 }} />
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--red-600)" }}>Predicted {supply.prediction.group} shortage</b> in {supply.prediction.area} within {supply.prediction.window}. {supply.prediction.note}. ThalNet is pre-mobilising {supply.prediction.group} donors now.
              </div>
            </div>
            <Divider style={{ margin: "16px 0" }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 10, letterSpacing: ".02em" }}>NEARBY BLOOD BANKS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {supply.banks.map((bk, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: bk.open ? "var(--green-500)" : "var(--faint)" }} />
                  <div style={{ flex: 1, fontWeight: 600 }}>{bk.name} <span style={{ color: "var(--faint)", fontWeight: 400 }}>· {bk.area}</span></div>
                  <span className="mono" style={{ color: "var(--muted)" }}>{bk.km}km</span>
                  <span className="mono tnum" style={{ fontWeight: 700, width: 56, textAlign: "right", color: bk.open ? "var(--ink)" : "var(--faint)" }}>{bk.units} units</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT: churn alerts + agent feed + escalation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* churn alerts */}
          <Card pad={22}>
            <Eyebrow color="var(--muted)">Donor care · recommended actions</Eyebrow>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}>
              {alerts.map(a => {
                const act = ACTIONS[a.action];
                const isDone = done[a.id];
                const churnTone = a.churn > 0.5 ? "var(--red-500)" : a.churn > 0.25 ? "var(--amber-600)" : "var(--green-600)";
                return (
                  <div key={a.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 15, opacity: isDone ? .55 : 1, transition: "opacity .3s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={a.donor} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{a.donor} <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 13 }}>· {a.group}</span></div>
                        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>for {a.bridge}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="tnum mono" style={{ fontSize: 15, fontWeight: 800, color: churnTone }}>{Math.round(a.churn * 100)}%</div>
                        <div style={{ fontSize: 10, color: "var(--faint)", fontWeight: 600, letterSpacing: ".05em" }} className="mono">CHURN RISK</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.45 }}>{a.reason}.</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                        <Icon name="auto_awesome" size={15} color="#1f5fa6" /> {a.rec}
                      </div>
                      {isDone
                        ? <Badge tone="green" icon="check">Done</Badge>
                        : <Button variant={act.variant} size="sm" icon={act.icon} onClick={() => resolve(a.id)}>{act.label}</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* agent feed */}
          <Card pad={22} style={{ background: "#16171c", border: "1px solid #24262e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Eyebrow color="#7fd3a8">Autonomous agent · live</Eyebrow>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#7fd3a8", animation: "blink 1.6s infinite" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }} className="mono">
              {agentFeed.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, lineHeight: 1.45 }}>
                  <span style={{ color: "#5a5d68" }}>{f.t}</span>
                  <span style={{ color: f.ok ? "#7fd3a8" : "#e8a14c", flexShrink: 0 }}>{f.ok ? "✓" : "!"}</span>
                  <span style={{ color: "#c3c6cf" }}>{f.msg}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #24262e", fontSize: 12, color: "#7a7d87" }} className="mono">
              {s.escalations} batches escalated to queue → human review
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminView });
