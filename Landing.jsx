/* ThalNet — landing page. Explains Blood Warriors + ThalNet, role selection.
   Honest, warm, clinical. */

function StatChip({ value, label }) {
  return (
    <div style={{ flex: "1 1 150px" }}>
      <div className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

function RoleCard({ icon, role, title, desc, points, onPick, accent }) {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={() => onPick(role)}
      style={{
        background: "#fff", border: `1px solid ${h ? "var(--red-200, #f3c6c9)" : "var(--line)"}`,
        borderRadius: "var(--r-xl)", padding: 26, cursor: "pointer", flex: "1 1 260px",
        boxShadow: h ? "var(--sh-lg)" : "var(--sh-sm)", transform: h ? "translateY(-3px)" : "none",
        transition: "all .22s ease", display: "flex", flexDirection: "column",
      }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: accent.bg, display: "grid", placeItems: "center", marginBottom: 16 }}>
        <Icon name={icon} size={26} fill color={accent.fg} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</div>
      <p style={{ fontSize: 14.5, color: "var(--muted)", marginTop: 7, lineHeight: 1.5, flex: 1 }}>{desc}</p>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {points.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13.5, color: "var(--ink-soft)" }}>
            <Icon name="check" size={16} color={accent.fg} /> {p}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: accent.fg, fontSize: 14.5 }}>
        Enter as {title.split(" ")[0].toLowerCase() === "i'm" ? title.split(" ").slice(1).join(" ") : title}
        <Icon name="arrow_forward" size={18} style={{ transform: h ? "translateX(4px)" : "none", transition: "transform .2s" }} />
      </div>
    </div>
  );
}

function Landing({ onPick }) {
  const { adminStats, supply } = window.TN;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.86)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone="red" dot style={{ background: "transparent" }}>powered by Blood Warriors</Badge>
            <Button variant="ghost" size="sm" onClick={() => onPick("donor")}>Sign in</Button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "60px 22px 30px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 48, alignItems: "center" }} className="hero-grid">
          <div className="fade-up">
            <Eyebrow>A Blood Warriors initiative</Eyebrow>
            <h1 style={{ fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.05, marginTop: 16, color: "var(--ink)" }}>
              Every thalassemia patient deserves a <span style={{ color: "var(--red-500)" }}>bridge</span> of donors who show up.
            </h1>
            <p style={{ fontSize: 18, color: "var(--ink-soft)", marginTop: 20, lineHeight: 1.55, maxWidth: 520 }}>
              Thalassemia is lifelong — a child may need 500 to 700 transfusions in their life. ThalNet quietly builds and maintains a steady circle of donors around each patient, so the blood is there when it's needed. No scrambling. No last-minute calls.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" icon="water_drop" onClick={() => onPick("donor")}>I want to donate</Button>
              <Button variant="ghost" size="lg" icon="favorite" onClick={() => onPick("patient")}>I need support</Button>
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 36, flexWrap: "wrap" }}>
              <StatChip value="1,284" label="donors in the network" />
              <StatChip value="47" label="active blood bridges" />
              <StatChip value={supply.nationalBanks.toLocaleString("en-IN")} label="blood banks tracked nationwide" />
            </div>
          </div>

          {/* mini bridge preview */}
          <div className="fade-up" style={{ animationDelay: ".1s" }}>
            <Card pad={24} style={{ borderRadius: "var(--r-xl)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Eyebrow color="var(--muted)">The Blood Bridge</Eyebrow>
                <Badge tone="green" dot>self-healing</Badge>
              </div>
              <BloodBridge patient={window.TN.patient} donors={window.TN.bridgeDonors} compact />
            </Card>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 22px" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 36px" }}>
          <Eyebrow style={{ justifyContent: "center" }}>How ThalNet helps</Eyebrow>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", marginTop: 12 }}>The coordination happens quietly in the background.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 16 }}>
          {[
            { icon: "hub", t: "Builds the bridge", d: "Matches each patient with 8–10 compatible donors nearby — by blood group, distance, and reliability." },
            { icon: "cardiology", t: "Keeps it healthy", d: "Watches for donors going quiet and quietly recruits replacements before a gap can form." },
            { icon: "forum", t: "Reaches out kindly", d: "Contacts donors in English, Hindi or Telugu, listens to replies, and follows up gently." },
            { icon: "insights", t: "Reads the supply", d: "Tracks real blood-bank stock across India to spot shortages before they bite." },
          ].map((c, i) => (
            <Card key={i} pad={22}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--red-50)", display: "grid", placeItems: "center" }}>
                <Icon name={c.icon} size={24} color="var(--red-500)" fill />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16.5, marginTop: 14, letterSpacing: "-.02em" }}>{c.t}</div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{c.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* role selection */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "30px 22px 70px" }}>
        <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 30px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }}>Where do you fit in?</h2>
          <p style={{ color: "var(--muted)", marginTop: 10, fontSize: 16 }}>Choose how you'd like to enter. You can switch views anytime in this demo.</p>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <RoleCard role="patient" icon="favorite" title="I'm a Patient" accent={{ fg: "var(--red-500)", bg: "var(--red-50)" }}
            desc="See your bridge, your next transfusion, and who's confirmed — with no surprises and no jargon."
            points={["Bridge health at a glance", "Request or flag urgent need", "Help in your language"]} onPick={onPick} />
          <RoleCard role="donor" icon="volunteer_activism" title="I'm a Donor" accent={{ fg: "var(--green-600)", bg: "var(--green-100)" }}
            desc="Know exactly when you're eligible and who you can help next — so giving fits into your life."
            points={["Your donation clock", "Reserve a slot ahead of time", "See the good you've done"]} onPick={onPick} />
          <RoleCard role="admin" icon="space_dashboard" title="I'm a Coordinator" accent={{ fg: "#1f5fa6", bg: "#e8f1fb" }}
            desc="Watch every bridge, act on churn alerts, and read national supply — all in one operations view."
            points={["Live bridge-health board", "Recommended actions", "Supply intelligence"]} onPick={onPick} />
        </div>
      </section>

      {/* honest footer note */}
      <section style={{ background: "var(--ink)", color: "#fff" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 560 }}>
            <Logo mono />
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.55, color: "rgba(255,255,255,.78)" }}>
              ThalNet doesn't promise a cure or count your streaks. It just makes sure the next transfusion is covered — and quietly says thank you to the people who make that possible.
            </p>
          </div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", lineHeight: 1.8 }}>
            Emergency? Call <a href="tel:+916281477836" style={{ color: "#fff", fontWeight: 600 }}>+91 62814 77836</a><br/>
            contact@bloodwarriors.in<br/>
            Hyderabad, Telangana, India
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { Landing });
