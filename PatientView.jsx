/* ThalNet — Patient dashboard. Honest, calm operational transparency.
   NO cure framing, NO progress-toward-health, NO gamification. */

function MiniStat({ value, label, tone }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <div className="tnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", color: tone || "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function PatientView() {
  const p = window.TN.patient;
  const donors = window.TN.bridgeDonors;
  const [urgent, setUrgent] = useState(false);
  const [requested, setRequested] = useState(false);
  const hc = HEALTH[p.bridge.health];

  const tlIcon = { confirmed: "check_circle", agent: "auto_awesome", alert: "build", done: "water_drop" };
  const tlColor = { confirmed: "var(--green-500)", agent: "#1f5fa6", alert: "var(--amber-500)", done: "var(--red-500)" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 22px 80px" }}>
      {/* greeting */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: "var(--muted)" }}>Good morning,</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", marginTop: 2 }}>{p.name.split(" ")[0]}'s care</h1>
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{p.diagnosis} · {p.group} · {p.hospital}</div>
      </div>

      {/* next transfusion — the calm headline */}
      <Card pad={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 0 }} className="pt-next">
          <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 70, height: 70, borderRadius: 18, background: "var(--red-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="calendar_month" size={34} color="var(--red-500)" fill />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13.5, color: "var(--muted)", fontWeight: 600 }}>Next transfusion</div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>
                {p.nextTransfusion} · <span style={{ color: "var(--red-500)" }}>in {p.daysToTransfusion} days</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 4 }}>
                {p.unitsThisCycle} units needed · {p.bridge.confirmed} donor{p.bridge.confirmed !== 1 ? "s" : ""} confirmed, {p.bridge.contacted} more being contacted.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="primary" icon="bloodtype" onClick={() => setRequested(true)} disabled={requested}>
                {requested ? "Request sent" : "Request blood"}
              </Button>
              <Button variant="soft" icon="emergency" onClick={() => setUrgent(true)}>Flag urgent need</Button>
            </div>
          </div>
          {requested && (
            <div style={{ padding: "12px 24px", background: "var(--green-50)", borderTop: "1px solid var(--green-100)", display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "var(--green-600)", fontWeight: 600 }}>
              <Icon name="check_circle" size={18} fill /> Your care team and the bridge have been notified. We'll keep you posted here.
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 18 }} className="pt-grid">
        {/* bridge */}
        <Card pad={24}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <Eyebrow color="var(--muted)">Your blood bridge</Eyebrow>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", marginTop: 6 }}>The donors keeping you covered</div>
            </div>
            <StatusBadge status={p.bridge.health} map={HEALTH} />
          </div>
          <div style={{ margin: "12px 0 4px" }}>
            <BloodBridge patient={p} donors={donors} />
          </div>
          <Divider style={{ margin: "8px 0 16px" }} />
          <div style={{ display: "flex", gap: 14, textAlign: "center" }}>
            <MiniStat value={p.bridge.confirmed} label="Confirmed" tone="var(--green-600)" />
            <MiniStat value={p.bridge.contacted} label="Being contacted" tone="var(--amber-600)" />
            <MiniStat value={`${p.bridge.confirmed + p.bridge.scheduled}/${p.bridge.target}`} label="Bridge filled" />
            <MiniStat value={`${p.bridge.integrity}`} label="Integrity score" tone={hc.fg} />
          </div>
          {p.bridge.health === "at-risk" && (
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "var(--amber-50)", border: "1px solid var(--amber-100)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon name="info" size={18} color="var(--amber-600)" style={{ marginTop: 1 }} />
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                One donor recently went quiet. ThalNet is already reaching out to others and sourcing a replacement — there's nothing you need to do.
              </div>
            </div>
          )}
        </Card>

        {/* timeline + reassurance */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card pad={22}>
            <Eyebrow color="var(--muted)">What's happening</Eyebrow>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
              {p.timeline.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 13 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: "#fff", border: `2px solid ${tlColor[t.kind]}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name={tlIcon[t.kind]} size={16} color={tlColor[t.kind]} fill />
                    </div>
                    {i < p.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--line)", margin: "3px 0" }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{t.day} · {t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card pad={22} style={{ background: "var(--bg-warm)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Icon name="shield_with_heart" size={26} color="var(--red-500)" fill style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>You don't have to chase donors.</div>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                  That's our job. If a slot opens up, we fill it quietly. You'll only hear from us when there's something genuinely useful to share.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {urgent && <UrgentModal patient={p} onClose={() => setUrgent(false)} />}
    </div>
  );
}

/* Emergency request modal + simple real-time tracking */
function UrgentModal({ patient, onClose }) {
  const [stage, setStage] = useState(0); // 0 form, 1 tracking
  const [units, setUnits] = useState(2);
  const steps = [
    { icon: "send", label: "Request received", done: true },
    { icon: "groups", label: "12 nearby O+ donors ranked & notified", done: true },
    { icon: "forum", label: "3 donors replying…", done: false },
    { icon: "local_hospital", label: "Awaiting blood bank confirmation", done: false },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,15,20,.45)", backdropFilter: "blur(3px)", zIndex: 900, display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "var(--sh-lg)" }}>
        <div style={{ padding: "18px 22px", background: "var(--red-500)", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="emergency" size={24} fill />
          <div style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>Urgent blood need</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff" }}><Icon name="close" size={22} /></button>
        </div>
        {stage === 0 ? (
          <div style={{ padding: 22 }}>
            <p style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>This alerts your care team and the nearest available donors right away. Only use it when blood is needed soon.</p>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Blood group" value={patient.group} />
              <Field label="Hospital" value="Center for Thal." />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Units needed</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1,2,3,4].map(u => (
                  <button key={u} onClick={() => setUnits(u)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 16,
                    border: `1.5px solid ${units === u ? "var(--red-500)" : "var(--line)"}`,
                    background: units === u ? "var(--red-50)" : "#fff", color: units === u ? "var(--red-600)" : "var(--ink)",
                  }}>{u}</button>
                ))}
              </div>
            </div>
            <Button full variant="primary" size="lg" icon="bolt" style={{ marginTop: 20 }} onClick={() => setStage(1)}>Send urgent request</Button>
          </div>
        ) : (
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--red-500)", animation: "blink 1.4s infinite" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--red-600)" }}>Live · {units} units · {patient.group}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 13 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 99, display: "grid", placeItems: "center", background: s.done ? "var(--green-500)" : "#fff", border: s.done ? "none" : "2px solid var(--amber-500)" }}>
                      <Icon name={s.done ? "check" : s.icon} size={17} color={s.done ? "#fff" : "var(--amber-500)"} fill={!s.done} />
                    </div>
                    {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: "var(--line)" }} />}
                  </div>
                  <div style={{ paddingBottom: 14, paddingTop: 5 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.label}</div>
                    {!s.done && i === 2 && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Ravi Teja and Imran Khan are confirming now.</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--bg-warm)", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5, marginTop: 6 }}>
              Stay calm — help is moving. Your care team can see this too. We'll call you the moment a donor is confirmed.
            </div>
            <Button full variant="ghost" style={{ marginTop: 16 }} onClick={onClose}>Close — keep tracking in background</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", fontWeight: 600, fontSize: 15 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { PatientView });
