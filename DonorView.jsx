/* ThalNet — Donor dashboard. Warm, anticipatory, never performative.
   No streaks, no leaderboards, no badges. Quiet good. */

function DonorView() {
  const me = window.TN.me;
  const [reserved, setReserved] = useState(false);
  const [requests, setRequests] = useState([
    { id: "r1", initial: "A", group: "O+", km: 4, area: "Secunderabad", when: "Jun 18", hospital: "Center for Thalassemia & Blood Disorders", status: "open" },
    { id: "r2", initial: "S", group: "O+", km: 9, area: "Dilsukhnagar", when: "Jun 22", hospital: "Red Cross Blood Bank", status: "open" },
  ]);
  const act = (id, status) => setRequests(rs => rs.map(r => r.id === id ? { ...r, status } : r));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 22px 80px" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: "var(--muted)" }}>Welcome back,</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", marginTop: 2 }}>{me.name.split(" ")[0]}</h1>
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{me.group} donor · {me.city} · giving since {me.firstDonation}</div>
      </div>

      {/* clock hero */}
      <Card pad={28} style={{ marginBottom: 18 }}>
        <DonationClock me={me} reserved={reserved} onReserve={() => setReserved(true)} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }} className="dn-grid">
        {/* incoming requests */}
        <Card pad={22}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Eyebrow color="var(--muted)">When you're ready</Eyebrow>
            <Badge tone="neutral">{requests.filter(r => r.status === "open").length} nearby</Badge>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
            People nearby who'll need your blood group soon. There's no pressure — say yes only when it suits you.
          </p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map(r => (
              <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 16, background: r.status === "open" ? "#fff" : "var(--bg)" }}>
                <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--red-50)", color: "var(--red-500)", fontWeight: 800, fontSize: 18, display: "grid", placeItems: "center", border: "1px solid var(--red-100)" }}>{r.group}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>A patient {r.km}km away · {r.area}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 1 }}>Needed around {r.when} · {r.hospital}</div>
                  </div>
                </div>
                {r.status === "open" ? (
                  <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
                    <Button variant="green" size="sm" icon="check" onClick={() => act(r.id, "yes")} style={{ flex: 1 }}>I can help</Button>
                    <Button variant="ghost" size="sm" onClick={() => act(r.id, "no")}>Not this time</Button>
                  </div>
                ) : r.status === "yes" ? (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--green-600)", fontWeight: 600, fontSize: 13.5 }}>
                    <Icon name="check_circle" size={18} fill /> Thank you. We'll send the details closer to {r.when}.
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", color: "var(--muted)", fontSize: 13.5 }}>
                    <Icon name="schedule" size={18} /> No problem — we'll only reach out when you're free.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* impact + history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card pad={22}>
            <Eyebrow color="var(--muted)">Your quiet impact</Eyebrow>
            <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
              <Stat value={me.unitsDonated} label="units donated" />
              <div style={{ width: 1, background: "var(--line)" }} />
              <Stat value={me.patientsHelped} label="patients you've helped" color="var(--green-600)" />
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 16, lineHeight: 1.5, padding: "12px 14px", background: "var(--bg-warm)", borderRadius: 12 }}>
              That's real. Each unit is roughly one more month a child didn't have to worry. Thank you — that's all, just thank you.
            </p>
          </Card>

          <Card pad={22}>
            <Eyebrow color="var(--muted)">Where your blood went</Eyebrow>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
              {me.history.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 13, padding: "12px 0", borderBottom: i < me.history.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--green-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="water_drop" size={19} color="var(--green-500)" fill />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{h.reached}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{h.date} · {h.place}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 600, whiteSpace: "nowrap" }}>{h.units} unit</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DonorView });
