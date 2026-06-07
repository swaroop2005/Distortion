/* ThalNet Auth Modal — Sign In + Role Picker */
const { useState } = React;

function AuthModal({ onSuccess, onRole }) {
  const [screen, setScreen] = useState("role"); // role | signin | otp | patient-onboard
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Access from window scope (exported by thalnet-shared.jsx)
  const Card = window.Card;
  const Ic = window.Ic;
  const T = window.T;
  const PatientOnboardingWizard = window.PatientOnboardingWizard;

  const handleSendOtp = async () => {
    if (!phone.match(/^\d{10}$/)) { setError("Enter 10-digit number"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + phone }),
      });
      const data = await res.json();
      if (res.ok) { setOtpSent(true); setOtp(""); setOtpAttempts(0); }
      else { setError(data.detail || "Failed to send OTP"); }
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    if (otpAttempts >= 3) { setError("Too many attempts. Wait 5 min."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + phone, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("role", data.role || "patient");
        onRole(data.role || "patient");
        onSuccess();
      } else if (res.status === 404) {
        setError("Not registered. Sign up instead?");
      } else {
        setError(data.detail || "Wrong OTP");
        setOtpAttempts(a => a + 1);
      }
    } catch (e) { setError("Network error"); }
    finally { setLoading(false); }
  };

  // Role Picker screen
  if (screen === "role") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card pad={32} style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 8 }}>Welcome to ThalNet</div>
          <div style={{ fontSize: 14, color: T.soft, marginBottom: 28 }}>A steady circle of donors for every thalassemia patient</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {[
              { k: "patient", l: "I need support", i: "favorite", col: T.red, sub: "Build your blood bridge" },
              { k: "donor",   l: "I want to donate", i: "water_drop", col: T.green, sub: "Join a patient's bridge" },
            ].map(opt => (
              <button key={opt.k} onClick={() => {
                setSelectedRole(opt.k);
                if (opt.k === "patient") {
                  setScreen("patient-onboard");
                } else {
                  setScreen("signin");
                }
              }} style={{
                display: "flex", gap: 14, alignItems: "center", padding: "18px 20px", borderRadius: 14,
                border: `2px solid ${T.line}`, background: T.surface, cursor: "pointer",
                transition: "all .2s", textAlign: "left",
              }} onMouseEnter={e => e.currentTarget.style.borderColor = opt.col} onMouseLeave={e => e.currentTarget.style.borderColor = T.line}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: opt.k === "patient" ? T.redSoft : T.greenSoft, display: "grid", placeItems: "center", flexShrink: 0, borderLeft: `4px solid ${opt.col}` }}>
                  <Ic n={opt.i} z={24} fill col={opt.col} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{opt.l}</div>
                  <div style={{ fontSize: 12.5, color: T.soft, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13.5, color: T.soft, marginBottom: 18 }}>
            Already registered? <button onClick={() => setScreen("signin")} style={{ background: "none", border: "none", color: T.red, fontWeight: 700, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}>Sign in</button>
          </div>

          <div style={{ fontSize: 11.5, color: T.soft, display: "flex", justifyContent: "space-around", paddingTop: 18, borderTop: `1px solid ${T.line}` }}>
            <span><b>1,284</b> donors</span>
            <span><b>47</b> bridges</span>
            <span><b>3,863</b> banks</span>
          </div>
        </Card>
      </div>
    );
  }

  // Patient onboarding screen
  if (screen === "patient-onboard") {
    return <PatientOnboardingWizard onComplete={() => {
      onRole("patient");
      onSuccess();
    }} />;
  }

  // Sign In screen
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card pad={32} style={{ maxWidth: 420 }}>
        <button onClick={() => setScreen("role")} style={{ background: "none", border: "none", color: T.soft, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Ic n="arrow_back" z={18} col={T.soft} /> Back
        </button>

        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
          {otpSent ? "Enter OTP" : "Sign in"}
        </div>
        <div style={{ fontSize: 13.5, color: T.soft, marginBottom: 24 }}>
          {otpSent ? `We sent a code to +91 ${phone}` : "Enter your phone number to continue"}
        </div>

        {!otpSent ? (
          <>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.soft, marginBottom: 6 }}>Phone number</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <input disabled value="+91" style={{ width: 50, padding: "11px 10px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} />
              <input value={phone} onChange={e => { setPhone(e.target.value); setError(""); }} placeholder="9876543210" style={{
                flex: 1, padding: "11px 14px", borderRadius: 10, border: `1px solid ${error ? T.red : T.line}`,
                fontSize: 14, fontFamily: "inherit", transition: "border-color .2s",
              }} onKeyDown={e => e.key === "Enter" && handleSendOtp()} />
            </div>
            {error && <div style={{ fontSize: 12, color: T.red, marginBottom: 14 }}>{error}</div>}
            <button onClick={handleSendOtp} disabled={loading} style={{
              width: "100%", padding: "12px", borderRadius: 10, background: T.redV,
              color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit", opacity: loading ? 0.7 : 1, transition: "opacity .2s",
            }}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.soft, marginBottom: 6 }}>6-digit code</label>
            <input value={otp} onChange={e => { setOtp(e.target.value.slice(0, 6)); setError(""); }} placeholder="000000" maxLength={6} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${error ? T.red : T.line}`,
              fontSize: 20, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, letterSpacing: "4px",
              marginBottom: 18, textAlign: "center", transition: "border-color .2s",
            }} onKeyDown={e => e.key === "Enter" && handleVerifyOtp()} autoFocus />
            {error && <div style={{ fontSize: 12, color: T.red, marginBottom: 14 }}>{error}</div>}
            <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} style={{
              width: "100%", padding: "12px", borderRadius: 10, background: T.redV,
              color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit", opacity: (loading || otp.length < 6) ? 0.6 : 1, transition: "opacity .2s",
            }}>
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button onClick={() => { setOtpSent(false); setPhone(""); setError(""); }} style={{
              width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, background: "transparent",
              color: T.soft, border: `1px solid ${T.line}`, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Use different number
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { AuthModal });
