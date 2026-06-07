/* ThalNet — Donation Clock. Anticipatory, calm. Flips reactive → proactive.
   Tone: a kind nurse. No pressure, no guilt. */

function DonationClock({ me, onReserve, reserved }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  const pct = Math.min(100, Math.round((me.daysSince / me.cycleDays) * 100));
  const eligible = me.eligibleInDays <= 0;
  const size = 230, stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = mounted ? pct : 0;

  return (
    <div style={{ display: "grid", gap: 22, gridTemplateColumns: "minmax(0,1fr)", alignItems: "center" }}>
      {/* the clock */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <defs>
              <linearGradient id="clockGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={eligible ? "var(--green-500)" : "var(--red-400)"} />
                <stop offset="100%" stopColor={eligible ? "var(--green-600)" : "var(--red-500)"} />
              </linearGradient>
            </defs>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#clockGrad)" strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100}
              style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            {eligible ? (
              <div>
                <Icon name="favorite" size={30} fill color="var(--green-500)" />
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginTop: 4 }}>You're eligible</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>whenever you're ready</div>
              </div>
            ) : (
              <div>
                <div className="tnum" style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-.04em", lineHeight: .95 }}>{me.eligibleInDays}</div>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>days until eligible</div>
                <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>{me.eligibleDate}</div>
              </div>
            )}
          </div>
        </div>
        <p style={{ marginTop: 18, color: "var(--ink-soft)", fontSize: 15, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          {eligible
            ? "You can give again. There's no rush — we'll be here when the time feels right."
            : <>You gave on {me.lastDonated}. You'll be eligible again on <b>{me.eligibleDate}</b>. We'll check in then.</>}
        </p>
      </div>

      {/* anticipatory match */}
      <div style={{
        border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden",
        background: "linear-gradient(180deg, var(--bg-warm), #fff)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <Badge tone="ai" icon="auto_awesome">Looking ahead for you</Badge>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0, display: "grid", placeItems: "center",
              background: "var(--red-50)", color: "var(--red-500)", fontWeight: 800, fontSize: 22,
              border: "1px solid var(--red-100)",
            }}>{me.match.group}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16.5, lineHeight: 1.45, color: "var(--ink)", fontWeight: 500 }}>
                There's a patient <b>{me.match.km}km away</b> in {me.match.area} who'll need {me.match.group} blood
                around <b>{me.match.neededDate}</b> — right about when you're eligible.
              </p>
              <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
                {me.match.hospital}. Only their care team and ThalNet can see this — never the patient.
              </p>
            </div>
          </div>

          {reserved ? (
            <div style={{
              marginTop: 18, padding: "14px 16px", borderRadius: 12, background: "var(--green-50)",
              border: "1px solid var(--green-100)", display: "flex", gap: 10, alignItems: "center",
            }}>
              <Icon name="check_circle" size={22} fill color="var(--green-500)" />
              <div>
                <div style={{ fontWeight: 700, color: "var(--green-600)", fontSize: 14.5 }}>Slot reserved for {me.match.neededDate}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>We'll send a gentle reminder a day before. You can change your mind anytime.</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" icon="event_available" onClick={onReserve}>Reserve my slot</Button>
              <Button variant="ghost">Maybe later</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DonationClock });
