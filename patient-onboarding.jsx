/* ThalNet Patient Onboarding Wizard — 4 steps */

function PatientOnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: "", phone: "", whatsapp: true, dob: "",
    isForOther: false, patientName: "", relationship: "", patientDob: "",
    group: "", thalType: "", frequency: "", lastTx: "",
    city: "", district: "", hospital: "",
    emergencyName: "", emergencyPhone: "", emergencyRelation: "",
    language: "en",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const T = window.T;
  const Card = window.Card;
  const Ic = window.Ic;

  // Validation
  const validateStep = (s) => {
    const err = {};
    if (s === 1) {
      if (!data.name) err.name = "Name required";
      if (!data.phone.match(/^\d{10}$/)) err.phone = "10-digit number required";
      if (!data.dob) err.dob = "DOB required";
      if (data.isForOther) {
        if (!data.patientName) err.patientName = "Patient name required";
        if (!data.patientDob) err.patientDob = "Patient DOB required";
      }
    } else if (s === 2) {
      if (!data.group) err.group = "Blood group required";
      if (!data.thalType) err.thalType = "Thalassemia type required";
      if (["Major", "Intermedia"].includes(data.thalType) && !data.frequency) err.frequency = "Frequency required";
    } else if (s === 3) {
      if (!data.city) err.city = "City required";
      if (!data.district) err.district = "District required";
    } else if (s === 4) {
      if (!data.emergencyName) err.emergencyName = "Emergency contact name required";
      if (!data.emergencyPhone.match(/^\d{10}$/)) err.emergencyPhone = "10-digit number required";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 4) setStep(step + 1);
      else handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/patients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+91" + data.phone,
          name: data.name,
          dob: data.dob,
          isForSelf: !data.isForOther,
          patientName: data.isForOther ? data.patientName : data.name,
          patientDob: data.isForOther ? data.patientDob : data.dob,
          bloodGroup: data.group,
          thalassemiaType: data.thalType,
          transfusionFrequency: data.frequency,
          lastTransfusion: data.lastTx,
          city: data.city,
          district: data.district,
          hospital: data.hospital,
          emergencyContactName: data.emergencyName,
          emergencyContactPhone: "+91" + data.emergencyPhone,
          emergencyContactRelation: data.emergencyRelation,
          preferredLanguage: data.language,
          whatsapp: data.whatsapp,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => onComplete(data), 2500);
      } else {
        setErrors({ submit: "Registration failed" });
      }
    } catch (e) {
      setErrors({ submit: "Network error" });
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card pad={40} style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: "pulse 1.2s ease-out" }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: T.green }}>Bridge being built</div>
          <div style={{ fontSize: 14, color: T.soft, marginBottom: 20, lineHeight: 1.5 }}>
            Your blood bridge is being built. We'll WhatsApp you when the first donor confirms.
          </div>
          <div style={{ padding: "16px", borderRadius: 12, background: T.greenSoft, color: T.green, fontSize: 12.5, fontWeight: 600, marginBottom: 20 }}>
            0 of 8 donors confirmed
          </div>
          <button onClick={() => onComplete(data)} style={{ width: "100%", padding: "12px", borderRadius: 10, background: T.green, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Ic n="dashboard" z={18} fill col="#fff" /> Go to dashboard
          </button>
        </Card>
      </div>
    );
  }

  const steps = ["About You", "Medical", "Location", "Emergency"];
  const progress = (step / 4) * 100;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Card pad={32} style={{ maxWidth: 500, width: "100%" }}>
        {/* progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i < step ? T.green : i === step - 1 ? T.amber : T.line, transition: "background .3s" }} />
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.soft, letterSpacing: ".05em", textTransform: "uppercase" }}>
            Step {step} of 4: {steps[step - 1]}
          </div>
        </div>

        {/* step 1: about you */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Your name *</label>
              <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="Full name" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.name ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
              {errors.name && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Phone +91 *</label>
                <input value={data.phone} onChange={e => setData({ ...data, phone: e.target.value.slice(0, 10) })} placeholder="9876543210" maxLength={10} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.phone ? T.red : T.line}`, fontSize: 14, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} />
                {errors.phone && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.phone}</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Date of birth *</label>
                <input type="date" value={data.dob} onChange={e => setData({ ...data, dob: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.dob ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
                {errors.dob && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.dob}</div>}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={data.whatsapp} onChange={e => setData({ ...data, whatsapp: e.target.checked })} style={{ width: 18, height: 18, accentColor: T.green, cursor: "pointer" }} />
              <span style={{ fontSize: 13.5, color: T.ink }}>Reach me on WhatsApp</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={data.isForOther} onChange={e => setData({ ...data, isForOther: e.target.checked })} style={{ width: 18, height: 18, accentColor: T.red, cursor: "pointer" }} />
              <span style={{ fontSize: 13.5, color: T.ink }}>Registering for someone else</span>
            </label>
            {data.isForOther && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Patient name *</label>
                  <input value={data.patientName} onChange={e => setData({ ...data, patientName: e.target.value })} placeholder="Full name" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.patientName ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
                  {errors.patientName && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.patientName}</div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Relationship *</label>
                    <select value={data.relationship} onChange={e => setData({ ...data, relationship: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit" }}>
                      <option value="">Select</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="spouse">Spouse</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Patient DOB *</label>
                    <input type="date" value={data.patientDob} onChange={e => setData({ ...data, patientDob: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.patientDob ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
                    {errors.patientDob && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.patientDob}</div>}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* step 2: medical */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Blood group *</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-", "Bombay"].map(g => (
                  <button key={g} onClick={() => setData({ ...data, group: g })} style={{
                    padding: "10px 12px", borderRadius: 10, border: `2px solid ${data.group === g ? T.red : T.line}`, background: data.group === g ? T.redSoft : "#fff",
                    fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", color: data.group === g ? T.red : T.ink,
                  }}>
                    {g}
                  </button>
                ))}
              </div>
              <button style={{ fontSize: 12.5, color: T.soft, background: "none", border: "none", cursor: "pointer", marginTop: 8, fontFamily: "inherit" }}>Not sure? Skip</button>
              {errors.group && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.group}</div>}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Thalassemia type *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { k: "Major", l: "Thalassemia Major", d: "Regular transfusions (every 2–4 weeks)" },
                  { k: "Intermedia", l: "Thalassemia Intermedia", d: "Occasional transfusions" },
                  { k: "Minor", l: "Thalassemia Minor / Trait", d: "Usually no transfusions needed" },
                ].map(t => (
                  <button key={t.k} onClick={() => setData({ ...data, thalType: t.k })} style={{
                    padding: "12px 14px", borderRadius: 10, border: `2px solid ${data.thalType === t.k ? T.red : T.line}`, background: data.thalType === t.k ? T.redSoft : "#fff",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all .15s",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: data.thalType === t.k ? T.red : T.ink }}>{t.l}</div>
                    <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{t.d}</div>
                  </button>
                ))}
              </div>
              {errors.thalType && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.thalType}</div>}
            </div>
            {["Major", "Intermedia"].includes(data.thalType) && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Transfusion frequency *</label>
                <select value={data.frequency} onChange={e => setData({ ...data, frequency: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.frequency ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }}>
                  <option value="">Select</option><option value="2wk">Every 2 weeks</option><option value="3wk">Every 3 weeks</option><option value="monthly">Every month</option><option value="varies">Varies</option>
                </select>
                {errors.frequency && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.frequency}</div>}
              </div>
            )}
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Last transfusion (optional)</label>
              <input type="date" value={data.lastTx} onChange={e => setData({ ...data, lastTx: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit" }} />
            </div>
          </>
        )}

        {/* step 3: location */}
        {step === 3 && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>City *</label>
              <input value={data.city} onChange={e => setData({ ...data, city: e.target.value })} placeholder="Hyderabad" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.city ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
              {errors.city && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.city}</div>}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>District *</label>
              <input value={data.district} onChange={e => setData({ ...data, district: e.target.value })} placeholder="Hyderabad" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.district ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
              {errors.district && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.district}</div>}
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Preferred hospital (optional)</label>
              <input value={data.hospital} onChange={e => setData({ ...data, hospital: e.target.value })} placeholder="Start typing…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit" }} />
              <div style={{ fontSize: 11, color: T.soft, marginTop: 6 }}>Location used only to find nearby donors and banks.</div>
            </div>
          </>
        )}

        {/* step 4: emergency */}
        {step === 4 && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Emergency contact name *</label>
              <input value={data.emergencyName} onChange={e => setData({ ...data, emergencyName: e.target.value })} placeholder="Full name" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.emergencyName ? T.red : T.line}`, fontSize: 14, fontFamily: "inherit" }} />
              {errors.emergencyName && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.emergencyName}</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Phone +91 *</label>
                <input value={data.emergencyPhone} onChange={e => setData({ ...data, emergencyPhone: e.target.value.slice(0, 10) })} placeholder="9876543210" maxLength={10} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${errors.emergencyPhone ? T.red : T.line}`, fontSize: 14, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} />
                {errors.emergencyPhone && <div style={{ fontSize: 11.5, color: T.red, marginTop: 4 }}>{errors.emergencyPhone}</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Relationship *</label>
                <select value={data.emergencyRelation} onChange={e => setData({ ...data, emergencyRelation: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit" }}>
                  <option value="">Select</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="spouse">Spouse</option><option value="friend">Friend</option><option value="other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Language preference</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ k: "en", l: "English" }, { k: "hi", l: "हिंदी" }, { k: "te", l: "తెలుగు" }].map(lng => (
                  <button key={lng.k} onClick={() => setData({ ...data, language: lng.k })} style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10, border: `2px solid ${data.language === lng.k ? T.green : T.line}`, background: data.language === lng.k ? T.greenSoft : "#fff",
                    fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", color: data.language === lng.k ? T.green : T.ink,
                  }}>
                    {lng.l}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* navigation */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 1 && <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Back</button>}
          <button onClick={handleNext} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 10, background: T.red, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {step === 4 ? (loading ? "Creating bridge…" : "Create my blood bridge") : "Continue"}
          </button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { PatientOnboardingWizard });
