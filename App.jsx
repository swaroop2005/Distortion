/* ThalNet — app shell, role switcher, routing between views. */

function AppBar({ role, setScreen }) {
  const roles = [
    { key: "patient", label: "Patient", icon: "favorite" },
    { key: "donor", label: "Donor", icon: "volunteer_activism" },
    { key: "admin", label: "Coordinator", icon: "space_dashboard" },
  ];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "11px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div onClick={() => setScreen("landing")} style={{ cursor: "pointer" }}><Logo size={20} /></div>

        {/* role switcher */}
        <div style={{ display: "flex", gap: 4, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 99, padding: 4 }}>
          {roles.map(r => (
            <button key={r.key} onClick={() => setScreen(r.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, border: "none",
              padding: "8px 15px", borderRadius: 99, fontSize: 13.5, fontWeight: 600,
              background: role === r.key ? "var(--red-500)" : "transparent",
              color: role === r.key ? "#fff" : "var(--muted)", transition: "all .18s",
            }}>
              <Icon name={r.icon} size={17} fill={role === r.key} />
              <span className="rs-label">{r.label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{ width: 40, height: 40, borderRadius: 99, border: "1px solid var(--line)", background: "#fff", display: "grid", placeItems: "center" }}>
            <Icon name="notifications" size={20} color="var(--muted)" />
          </button>
          <Avatar name={role === "patient" ? "Anaya K" : role === "donor" ? "Arjun Mehta" : "Coordinator"} size={40} />
        </div>
      </div>
    </header>
  );
}

function App() {
  const [screen, setScreen] = useState("landing");
  const [, bumpLive] = useState(0);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  // Pull real backend data over the mock once, then re-render with live values.
  useEffect(() => { if (window.loadLiveTN) window.loadLiveTN(() => bumpLive(n => n + 1)); }, []);

  const ctx = {
    patient: "patient dashboard — bridge health, next transfusion, request blood",
    donor: "donor dashboard — donation clock, eligibility, nearby requests",
    admin: "coordinator operations — bridge board, churn alerts, supply",
    landing: "landing page — learning about ThalNet and Blood Warriors",
  }[screen];
  const chatRole = screen === "landing" ? "visitor" : screen;

  return (
    <div>
      {screen === "landing"
        ? <Landing onPick={setScreen} />
        : (
          <>
            <AppBar role={screen} setScreen={setScreen} />
            <main key={screen} className="fade-in">
              {screen === "patient" && <PatientView />}
              {screen === "donor" && <DonorView />}
              {screen === "admin" && <AdminView />}
            </main>
          </>
        )}
      <Chatbot role={chatRole} pageContext={ctx} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
