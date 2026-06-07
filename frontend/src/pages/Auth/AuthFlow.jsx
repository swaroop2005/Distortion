import { useState, useRef, useEffect } from 'react';

const T = {
  red: '#e63148',
  redSoft: '#fef2f2',
  navy: '#0a2540',
  bg: '#eef2f7',
  surface: '#ffffff',
  ink: '#16202c',
  soft: '#6b7a8d',
  green: '#17b26a',
  greenSoft: '#ecfdf5',
  amber: '#f5a524',
  amberSoft: '#fffbeb',
  line: '#e3e9f0',
  red_err: '#e5484d',
};

const inp = (err) => ({
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: `1.5px solid ${err ? T.red_err : T.line}`,
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color .15s',
});

const label = { display: 'block', fontSize: 12.5, fontWeight: 700, color: T.soft, marginBottom: 6, letterSpacing: '.03em' };

function ModalWrap({ children, onBack }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.surface, borderRadius: 18, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.soft, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', padding: 0 }}>
            ← Back
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function ProgressBar({ step, total, labels }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {labels.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i < step ? T.green : i === step - 1 ? T.red : T.line, transition: 'background .3s' }} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.soft, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Step {step} of {total}: {labels[step - 1]}
      </div>
    </div>
  );
}

function FieldErr({ msg }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11.5, color: T.red_err, marginTop: 4 }}>{msg}</div>;
}

// ─── OTP Sign-In ─────────────────────────────────────────────────────────────

function OtpVerify({ phone, onVerified, onBack }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSecs, setResendSecs] = useState(30);
  const [shake, setShake] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  const code = digits.join('');

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError('');
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      refs.current[5]?.focus();
    }
  };

  const verify = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code }),
      });
      const d = await r.json();
      if (r.ok) {
        onVerified(d.user_id, d.role);
      } else if (r.status === 404) {
        setError('No account found. Sign up instead.');
      } else {
        setError(d.detail || 'Incorrect code. Try again.');
        setShake(true);
        setTimeout(() => { setShake(false); setDigits(['', '', '', '', '', '']); refs.current[0]?.focus(); }, 600);
      }
    } catch {
      setError('Network error. Try again.');
    }
    setLoading(false);
  };

  const resend = async () => {
    setResendSecs(30);
    setDigits(['', '', '', '', '', '']);
    setError('');
    await fetch('/auth/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    refs.current[0]?.focus();
  };

  return (
    <ModalWrap onBack={onBack}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: T.ink }}>Enter OTP</div>
      <div style={{ fontSize: 13.5, color: T.soft, marginBottom: 28 }}>
        Code sent to <b style={{ fontFamily: 'monospace' }}>{phone}</b>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 8, justifyContent: 'center' }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            value={d}
            maxLength={1}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste}
            style={{
              width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
              fontFamily: 'monospace', borderRadius: 10, outline: 'none',
              border: `2px solid ${error ? T.red_err : code.length > i ? T.navy : T.line}`,
              transition: 'border-color .15s',
              animation: shake ? 'shake .4s ease' : 'none',
            }}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && <div style={{ fontSize: 12.5, color: T.red_err, textAlign: 'center', marginBottom: 12 }}>{error}</div>}

      <button
        onClick={verify}
        disabled={code.length < 6 || loading}
        style={{ width: '100%', padding: '12px', borderRadius: 10, background: code.length === 6 ? T.red : T.line, color: code.length === 6 ? '#fff' : T.soft, border: 'none', fontSize: 14, fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'default', fontFamily: 'inherit', marginTop: 8, transition: 'background .2s' }}
      >
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: T.soft }}>
        {resendSecs > 0
          ? <>Resend in <b style={{ color: T.ink }}>{resendSecs}s</b></>
          : <button onClick={resend} style={{ background: 'none', border: 'none', color: T.red, fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Resend code</button>
        }
      </div>
    </ModalWrap>
  );
}

function SignIn({ onVerified, onBack }) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentPhone, setSentPhone] = useState('');

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) { setError('Enter a valid 10-digit number'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + phone }),
      });
      const d = await r.json();
      if (r.ok) {
        setSentPhone('+91' + phone);
        // In dev mode show the OTP so testers can use it
        if (d.dev_otp) console.log('Dev OTP:', d.dev_otp);
        setStep('otp');
      } else {
        setError(d.detail || 'Failed to send OTP');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  if (step === 'otp') {
    return (
      <OtpVerify
        phone={sentPhone}
        onVerified={onVerified}
        onBack={() => setStep('phone')}
      />
    );
  }

  return (
    <ModalWrap onBack={onBack}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: T.ink }}>Sign in to ThalNet</div>
      <div style={{ fontSize: 13.5, color: T.soft, marginBottom: 24 }}>Enter your phone number to continue</div>

      <label style={label}>Phone number</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={{ padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${T.line}`, fontSize: 14, fontFamily: 'monospace', fontWeight: 600, color: T.ink, background: '#f6f8fa' }}>+91</div>
        <input
          value={phone}
          onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
          placeholder="9876543210"
          style={{ ...inp(error), flex: 1, fontFamily: 'monospace', fontWeight: 600 }}
          onKeyDown={e => e.key === 'Enter' && sendOtp()}
          autoFocus
        />
      </div>
      {error && <div style={{ fontSize: 12.5, color: T.red_err, marginBottom: 14 }}>{error}</div>}
      <button
        onClick={sendOtp}
        disabled={loading}
        style={{ width: '100%', padding: '12px', borderRadius: 10, background: T.red, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Sending…' : 'Send OTP'}
      </button>
    </ModalWrap>
  );
}

// ─── Patient Wizard ───────────────────────────────────────────────────────────

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-', 'Bombay'];

function PatientWizard({ onComplete, onBack }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '', phone: '', whatsapp: true, dob: '',
    isForOther: false, patientName: '', relationship: '', patientDob: '',
    group: '', thalType: '', frequency: '', lastTx: '',
    city: '', district: '', hospital: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    language: 'en',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState(null);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const validate = (s) => {
    const err = {};
    if (s === 1) {
      if (!data.name.trim()) err.name = 'Name required';
      if (!/^\d{10}$/.test(data.phone)) err.phone = '10-digit number required';
      if (!data.dob) err.dob = 'Date of birth required';
      if (data.isForOther) {
        if (!data.patientName.trim()) err.patientName = 'Patient name required';
        if (!data.patientDob) err.patientDob = 'Patient DOB required';
      }
    } else if (s === 2) {
      if (!data.thalType) err.thalType = 'Thalassemia type required';
      if (['Major', 'Intermedia'].includes(data.thalType) && !data.frequency) err.frequency = 'Frequency required';
    } else if (s === 3) {
      if (!data.city.trim()) err.city = 'City required';
      if (!data.district.trim()) err.district = 'District required';
    } else if (s === 4) {
      if (!data.emergencyName.trim()) err.emergencyName = 'Name required';
      if (!/^\d{10}$/.test(data.emergencyPhone)) err.emergencyPhone = '10-digit number required';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const next = () => {
    if (validate(step)) {
      if (step < 4) setStep(s => s + 1);
      else submit();
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const r = await fetch('/patients/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+91' + data.phone,
          name: data.name,
          dob: data.dob,
          is_for_self: !data.isForOther,
          patient_name: data.isForOther ? data.patientName : data.name,
          patient_dob: data.isForOther ? data.patientDob : data.dob,
          relationship: data.relationship || null,
          blood_group: data.group || null,
          thalassemia_type: data.thalType,
          transfusion_frequency: data.frequency || null,
          last_transfusion: data.lastTx || null,
          city: data.city,
          district: data.district,
          hospital: data.hospital || null,
          emergency_name: data.emergencyName,
          emergency_phone: '+91' + data.emergencyPhone,
          emergency_relation: data.emergencyRelation || null,
          language: data.language,
          whatsapp: data.whatsapp,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setUserId(d.user_id);
        setSuccess(true);
      } else {
        setErrors({ submit: d.detail || 'Registration failed' });
      }
    } catch {
      setErrors({ submit: 'Network error. Try again.' });
    }
    setLoading(false);
  };

  if (success) {
    return (
      <ModalWrap>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.greenSoft, border: `3px solid ${T.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.green, marginBottom: 8 }}>Your bridge is being built</div>
          <div style={{ fontSize: 14, color: T.soft, lineHeight: 1.6, marginBottom: 20 }}>
            We're finding compatible donors near you.<br />You'll get a WhatsApp message when your first donor confirms.
          </div>
          <div style={{ padding: '14px 20px', borderRadius: 12, background: T.greenSoft, color: T.green, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            0 of 8 donors confirmed (searching…)
          </div>
          {userId && <div style={{ fontSize: 11, color: T.soft, marginBottom: 16, fontFamily: 'monospace' }}>Your ID: {userId}</div>}
          <button
            onClick={() => onComplete(userId, 'patient')}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: T.green, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Go to my dashboard →
          </button>
        </div>
      </ModalWrap>
    );
  }

  const steps = ['About You', 'Medical', 'Location', 'Emergency'];

  return (
    <ModalWrap onBack={step === 1 ? onBack : undefined}>
      <ProgressBar step={step} total={4} labels={steps} />

      {step === 1 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Your name *</label>
            <input value={data.name} onChange={e => set('name', e.target.value)} placeholder="Full name" style={inp(errors.name)} />
            <FieldErr msg={errors.name} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={label}>Phone (+91) *</label>
              <input value={data.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" style={{ ...inp(errors.phone), fontFamily: 'monospace', fontWeight: 600 }} />
              <FieldErr msg={errors.phone} />
            </div>
            <div>
              <label style={label}>Date of birth *</label>
              <input type="date" value={data.dob} onChange={e => set('dob', e.target.value)} style={inp(errors.dob)} />
              <FieldErr msg={errors.dob} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={data.whatsapp} onChange={e => set('whatsapp', e.target.checked)} style={{ width: 17, height: 17, accentColor: T.green }} />
            <span style={{ fontSize: 13.5, color: T.ink }}>Reach me on WhatsApp</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={data.isForOther} onChange={e => set('isForOther', e.target.checked)} style={{ width: 17, height: 17, accentColor: T.red }} />
            <span style={{ fontSize: 13.5, color: T.ink }}>Registering for someone else</span>
          </label>
          {data.isForOther && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={label}>Patient's name *</label>
                <input value={data.patientName} onChange={e => set('patientName', e.target.value)} placeholder="Full name" style={inp(errors.patientName)} />
                <FieldErr msg={errors.patientName} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={label}>Relationship *</label>
                  <select value={data.relationship} onChange={e => set('relationship', e.target.value)} style={{ ...inp(false), background: '#fff' }}>
                    <option value="">Select</option>
                    {['Parent', 'Guardian', 'Sibling', 'Spouse', 'Other'].map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Patient's DOB *</label>
                  <input type="date" value={data.patientDob} onChange={e => set('patientDob', e.target.value)} style={inp(errors.patientDob)} />
                  <FieldErr msg={errors.patientDob} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: T.soft, padding: '10px 12px', background: T.amberSoft, borderRadius: 8, marginBottom: 14 }}>
                Many patients are children — caregivers can fully manage their bridge.
              </div>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Blood group</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 6 }}>
              {BLOOD_GROUPS.map(g => (
                <button key={g} onClick={() => set('group', data.group === g ? '' : g)} style={{
                  padding: '10px 8px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all .15s',
                  border: `2px solid ${data.group === g ? T.red : T.line}`,
                  background: data.group === g ? T.redSoft : '#fff',
                  color: data.group === g ? T.red : T.ink,
                }}>{g}</button>
              ))}
            </div>
            <button style={{ fontSize: 12, color: T.soft, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Not sure? Skip — add later from profile
            </button>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...label, marginBottom: 8 }}>Thalassemia type *</label>
            {[
              { k: 'Major', l: 'Thalassemia Major', d: 'Regular transfusions every 2–4 weeks' },
              { k: 'Intermedia', l: 'Thalassemia Intermedia', d: 'Occasional transfusions' },
              { k: 'Minor', l: 'Minor / Trait', d: 'Usually no transfusions needed' },
            ].map(t => (
              <button key={t.k} onClick={() => set('thalType', t.k)} style={{
                display: 'block', width: '100%', marginBottom: 8, padding: '12px 14px',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
                border: `2px solid ${data.thalType === t.k ? T.red : T.line}`,
                background: data.thalType === t.k ? T.redSoft : '#fff',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: data.thalType === t.k ? T.red : T.ink }}>{t.l}</div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{t.d}</div>
              </button>
            ))}
            <FieldErr msg={errors.thalType} />
          </div>
          {['Major', 'Intermedia'].includes(data.thalType) && (
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Transfusion frequency *</label>
              <select value={data.frequency} onChange={e => set('frequency', e.target.value)} style={{ ...inp(errors.frequency), background: '#fff' }}>
                <option value="">Select</option>
                <option value="2wk">Every 2 weeks</option>
                <option value="3wk">Every 3 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="varies">Varies</option>
              </select>
              <FieldErr msg={errors.frequency} />
            </div>
          )}
          <div>
            <label style={label}>Last transfusion (optional)</label>
            <input type="date" value={data.lastTx} onChange={e => set('lastTx', e.target.value)} style={inp(false)} />
            <div style={{ fontSize: 11.5, color: T.soft, marginTop: 4 }}>Helps us plan your next one</div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>City *</label>
            <input value={data.city} onChange={e => set('city', e.target.value)} placeholder="Hyderabad" style={inp(errors.city)} />
            <FieldErr msg={errors.city} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>District *</label>
            <input value={data.district} onChange={e => set('district', e.target.value)} placeholder="Hyderabad" style={inp(errors.district)} />
            <FieldErr msg={errors.district} />
          </div>
          <div>
            <label style={label}>Preferred hospital / blood bank (optional)</label>
            <input value={data.hospital} onChange={e => set('hospital', e.target.value)} placeholder="Start typing…" style={inp(false)} />
            <div style={{ fontSize: 11.5, color: T.soft, marginTop: 4 }}>Location used only to find nearby donors and banks</div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Emergency contact name *</label>
            <input value={data.emergencyName} onChange={e => set('emergencyName', e.target.value)} placeholder="Full name" style={inp(errors.emergencyName)} />
            <FieldErr msg={errors.emergencyName} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={label}>Phone (+91) *</label>
              <input value={data.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" style={{ ...inp(errors.emergencyPhone), fontFamily: 'monospace', fontWeight: 600 }} />
              <FieldErr msg={errors.emergencyPhone} />
            </div>
            <div>
              <label style={label}>Relationship</label>
              <select value={data.emergencyRelation} onChange={e => set('emergencyRelation', e.target.value)} style={{ ...inp(false), background: '#fff' }}>
                <option value="">Select</option>
                {['Parent', 'Spouse', 'Sibling', 'Friend', 'Other'].map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ ...label, marginBottom: 8 }}>Language preference</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ k: 'en', l: 'English' }, { k: 'hi', l: 'हिंदी' }, { k: 'te', l: 'తెలుగు' }].map(lng => (
                <button key={lng.k} onClick={() => set('language', lng.k)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, transition: 'all .15s',
                  border: `2px solid ${data.language === lng.k ? T.green : T.line}`,
                  background: data.language === lng.k ? T.greenSoft : '#fff',
                  color: data.language === lng.k ? T.green : T.ink,
                }}>{lng.l}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.soft, marginTop: 6 }}>We'll send updates in this language</div>
          </div>
          {errors.submit && <div style={{ fontSize: 13, color: T.red_err, marginTop: 14, padding: '10px 14px', background: T.redSoft, borderRadius: 8 }}>{errors.submit}</div>}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${T.line}`, background: '#fff', color: T.ink, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Back
          </button>
        )}
        <button onClick={next} disabled={loading} style={{ flex: 2, padding: '11px', borderRadius: 10, background: T.red, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {step === 4 ? (loading ? 'Creating bridge…' : 'Create my blood bridge') : 'Continue'}
        </button>
      </div>
    </ModalWrap>
  );
}

// ─── Donor Wizard ─────────────────────────────────────────────────────────────

function DonorWizard({ onComplete, onBack }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '', phone: '', dob: '', gender: '', whatsapp: true,
    group: '', weight: '', lastDonation: '', neverDonated: false,
    donorType: '',
    illnessLast4wk: false, onMedication: false, everDeferred: false,
    city: '', district: '', contactMethod: 'whatsapp', language: 'en', travelKm: 25,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState(null);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const ageYears = data.dob ? Math.floor((Date.now() - new Date(data.dob)) / 3.156e10) : null;
  const under18 = ageYears !== null && ageYears < 18;
  const under50kg = data.weight && parseFloat(data.weight) < 50;

  const recentDonation = (() => {
    if (!data.lastDonation || data.neverDonated) return null;
    const d = new Date(data.lastDonation);
    const eligible = new Date(d.getTime() + 90 * 86400000);
    return eligible > new Date() ? eligible : null;
  })();

  const hasHealthFlag = data.illnessLast4wk || data.onMedication || data.everDeferred;

  const validate = (s) => {
    const err = {};
    if (s === 1) {
      if (!data.name.trim()) err.name = 'Name required';
      if (!/^\d{10}$/.test(data.phone)) err.phone = '10-digit number required';
      if (!data.dob) err.dob = 'Date of birth required';
    } else if (s === 2) {
      if (!data.donorType) err.donorType = 'Select donor type';
    } else if (s === 3) {
      if (!data.city.trim()) err.city = 'City required';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const next = () => {
    if (validate(step)) {
      if (step < 3) setStep(s => s + 1);
      else submit();
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const r = await fetch('/donors/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+91' + data.phone,
          name: data.name,
          dob: data.dob,
          gender: data.gender || 'Unknown',
          blood_group: data.group || '',
          weight_kg: data.weight ? parseFloat(data.weight) : null,
          last_donation: data.neverDonated ? null : (data.lastDonation || null),
          donor_type: data.donorType,
          illness_last_4wk: data.illnessLast4wk,
          on_medication: data.onMedication,
          ever_deferred: data.everDeferred,
          city: data.city,
          district: data.district || data.city,
          contact_method: data.contactMethod,
          language: data.language,
          travel_km: data.travelKm,
          whatsapp: data.whatsapp,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setUserId(d.user_id);
        setSuccess(true);
      } else {
        setErrors({ submit: d.detail || 'Registration failed' });
      }
    } catch {
      setErrors({ submit: 'Network error. Try again.' });
    }
    setLoading(false);
  };

  if (success) {
    const eligible = !recentDonation;
    return (
      <ModalWrap>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.greenSoft, border: `3px solid ${T.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.green, marginBottom: 8 }}>You're in the network</div>
          <div style={{ fontSize: 14, color: T.soft, lineHeight: 1.6, marginBottom: 20 }}>
            {eligible
              ? "You're eligible to donate now. We'll match you with a patient nearby."
              : `You'll be eligible on ${recentDonation?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. We'll reach out then.`}
          </div>
          {userId && <div style={{ fontSize: 11, color: T.soft, marginBottom: 16, fontFamily: 'monospace' }}>Your ID: {userId}</div>}
          <button
            onClick={() => onComplete(userId, 'donor')}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: T.green, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View my dashboard →
          </button>
        </div>
      </ModalWrap>
    );
  }

  const steps = ['About You', 'Donation', 'Location'];

  return (
    <ModalWrap onBack={step === 1 ? onBack : undefined}>
      <ProgressBar step={step} total={3} labels={steps} />

      {step === 1 && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Your name *</label>
            <input value={data.name} onChange={e => set('name', e.target.value)} placeholder="Full name" style={inp(errors.name)} />
            <FieldErr msg={errors.name} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>Phone (+91) *</label>
              <input value={data.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" style={{ ...inp(errors.phone), fontFamily: 'monospace', fontWeight: 600 }} />
              <FieldErr msg={errors.phone} />
            </div>
            <div>
              <label style={label}>Date of birth *</label>
              <input type="date" value={data.dob} onChange={e => set('dob', e.target.value)} style={inp(errors.dob)} />
              <FieldErr msg={errors.dob} />
            </div>
          </div>
          {under18 && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: T.amberSoft, border: `1px solid ${T.amber}`, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Donors must be 18 or older</div>
              <div style={{ fontSize: 12, color: '#92400e' }}>Know an adult who'd like to help? Share ThalNet with them.</div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...label, marginBottom: 8 }}>Gender</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Male', 'Female', 'Other'].map(g => (
                <button key={g} onClick={() => set('gender', g)} style={{
                  flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, transition: 'all .15s',
                  border: `2px solid ${data.gender === g ? T.red : T.line}`,
                  background: data.gender === g ? T.redSoft : '#fff',
                  color: data.gender === g ? T.red : T.ink,
                }}>{g}</button>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={data.whatsapp} onChange={e => set('whatsapp', e.target.checked)} style={{ width: 17, height: 17, accentColor: T.green }} />
            <span style={{ fontSize: 13.5, color: T.ink }}>Reach me on WhatsApp</span>
          </label>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Blood group</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 6 }}>
              {BLOOD_GROUPS.map(g => (
                <button key={g} onClick={() => set('group', data.group === g ? '' : g)} style={{
                  padding: '10px 8px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all .15s',
                  border: `2px solid ${data.group === g ? T.green : T.line}`,
                  background: data.group === g ? T.greenSoft : '#fff',
                  color: data.group === g ? T.green : T.ink,
                }}>{g}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>Weight (kg)</label>
              <input type="number" value={data.weight} onChange={e => set('weight', e.target.value)} placeholder="60" style={inp(false)} />
              {under50kg && (
                <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 4, background: T.amberSoft, padding: '6px 8px', borderRadius: 6 }}>
                  Min. 50kg required — we'll check again when a request comes in.
                </div>
              )}
            </div>
            <div>
              <label style={label}>Last donation</label>
              <input type="date" value={data.lastDonation} disabled={data.neverDonated} onChange={e => set('lastDonation', e.target.value)} style={{ ...inp(false), opacity: data.neverDonated ? 0.4 : 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={data.neverDonated} onChange={e => set('neverDonated', e.target.checked)} style={{ accentColor: T.green }} />
                <span style={{ fontSize: 12, color: T.soft }}>Never donated</span>
              </label>
            </div>
          </div>

          {recentDonation && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: T.greenSoft, color: T.green, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
              You donated recently. Eligible again on {recentDonation.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. We'll reach out then.
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ ...label, marginBottom: 8 }}>Donor type *</label>
            {[
              { k: 'bridge', l: 'Bridge donor', d: 'Join a patient\'s team of 8 rotating donors. Donate every 3–4 months on a schedule.', color: T.green },
              { k: 'emergency', l: 'Emergency only', d: 'Get notified only for urgent needs nearby. No schedule commitment.', color: T.amber },
              { k: 'both', l: 'Both', d: 'Bridge team + emergency alerts.', color: T.red },
            ].map(t => (
              <button key={t.k} onClick={() => set('donorType', t.k)} style={{
                display: 'block', width: '100%', marginBottom: 8, padding: '12px 14px',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
                border: `2px solid ${data.donorType === t.k ? t.color : T.line}`,
                background: data.donorType === t.k ? (t.k === 'bridge' ? T.greenSoft : t.k === 'emergency' ? T.amberSoft : T.redSoft) : '#fff',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: data.donorType === t.k ? t.color : T.ink }}>{t.l}</div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{t.d}</div>
              </button>
            ))}
            <FieldErr msg={errors.donorType} />
          </div>

          <div style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${T.line}`, background: '#fafbfc' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Quick health check</div>
            {[
              { k: 'illnessLast4wk', l: 'Illness, fever, or infection in the last 4 weeks?' },
              { k: 'onMedication', l: 'Currently on any medications (other than vitamins)?' },
              { k: 'everDeferred', l: 'Ever been turned away from donating blood?' },
            ].map(q => (
              <label key={q.k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={data[q.k]} onChange={e => set(q.k, e.target.checked)} style={{ accentColor: T.amber, width: 16, height: 16 }} />
                <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>{q.l}</span>
              </label>
            ))}
            {hasHealthFlag && (
              <div style={{ fontSize: 11.5, color: '#92400e', padding: '8px 10px', background: T.amberSoft, borderRadius: 6, marginTop: 6 }}>
                No worries — the blood bank does a full screening. You can still register.
              </div>
            )}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={label}>City *</label>
              <input value={data.city} onChange={e => set('city', e.target.value)} placeholder="Hyderabad" style={inp(errors.city)} />
              <FieldErr msg={errors.city} />
            </div>
            <div>
              <label style={label}>District</label>
              <input value={data.district} onChange={e => set('district', e.target.value)} placeholder="Hyderabad" style={inp(false)} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ ...label, marginBottom: 8 }}>Contact method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ k: 'whatsapp', l: 'WhatsApp' }, { k: 'sms', l: 'SMS' }, { k: 'call', l: 'Call' }].map(c => (
                <button key={c.k} onClick={() => set('contactMethod', c.k)} style={{
                  flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all .15s',
                  border: `2px solid ${data.contactMethod === c.k ? T.green : T.line}`,
                  background: data.contactMethod === c.k ? T.greenSoft : '#fff',
                  color: data.contactMethod === c.k ? T.green : T.ink,
                }}>{c.l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ ...label, marginBottom: 8 }}>Language preference</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ k: 'en', l: 'English' }, { k: 'hi', l: 'हिंदी' }, { k: 'te', l: 'తెలుగు' }].map(lng => (
                <button key={lng.k} onClick={() => set('language', lng.k)} style={{
                  flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, transition: 'all .15s',
                  border: `2px solid ${data.language === lng.k ? T.green : T.line}`,
                  background: data.language === lng.k ? T.greenSoft : '#fff',
                  color: data.language === lng.k ? T.green : T.ink,
                }}>{lng.l}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ ...label, marginBottom: 8 }}>Willing to travel up to <b style={{ color: T.ink }}>{data.travelKm === 150 ? '100km+' : `${data.travelKm}km`}</b></label>
            <input
              type="range" min={5} max={150} step={5}
              value={data.travelKm}
              onChange={e => set('travelKm', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: T.green }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.soft, marginTop: 2 }}>
              <span>5km</span><span>25km</span><span>50km</span><span>100km+</span>
            </div>
          </div>

          {errors.submit && <div style={{ fontSize: 13, color: T.red_err, marginTop: 14, padding: '10px 14px', background: T.redSoft, borderRadius: 8 }}>{errors.submit}</div>}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${T.line}`, background: '#fff', color: T.ink, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Back
          </button>
        )}
        <button onClick={next} disabled={loading || (step === 1 && under18)} style={{ flex: 2, padding: '11px', borderRadius: 10, background: T.green, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: (loading || (step === 1 && under18)) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: (loading || (step === 1 && under18)) ? 0.5 : 1 }}>
          {step === 3 ? (loading ? 'Joining…' : 'Join the network') : 'Continue'}
        </button>
      </div>
    </ModalWrap>
  );
}

// ─── Landing (background) ─────────────────────────────────────────────────────

function Landing({ onSelectFlow }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🩸</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: '-.02em' }}>ThalNet</div>
          <div style={{ fontSize: 10.5, color: T.red, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>powered by Blood Warriors</div>
        </div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 900, color: T.ink, textAlign: 'center', marginBottom: 8, letterSpacing: '-.02em', maxWidth: 480 }}>
        Welcome to ThalNet
      </div>
      <div style={{ fontSize: 15, color: T.soft, textAlign: 'center', marginBottom: 36, maxWidth: 400 }}>
        A steady circle of donors for every thalassemia patient
      </div>

      {/* Role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 440, marginBottom: 24 }}>
        <button onClick={() => onSelectFlow('patient-new')} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '20px 22px', borderRadius: 16, border: `2px solid ${T.line}`, background: T.surface, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'border-color .2s, box-shadow .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.boxShadow = '0 4px 16px rgba(230,49,72,.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 12, background: T.redSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, borderLeft: `4px solid ${T.red}` }}>❤️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginBottom: 3 }}>I need support</div>
            <div style={{ fontSize: 12.5, color: T.soft }}>Build your blood bridge — a reliable team of donors around you</div>
          </div>
        </button>

        <button onClick={() => onSelectFlow('donor-new')} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '20px 22px', borderRadius: 16, border: `2px solid ${T.line}`, background: T.surface, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,.06)', transition: 'border-color .2s, box-shadow .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.boxShadow = '0 4px 16px rgba(23,178,106,.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 12, background: T.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, borderLeft: `4px solid ${T.green}` }}>💧</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginBottom: 3 }}>I want to donate</div>
            <div style={{ fontSize: 12.5, color: T.soft }}>Join a patient's bridge or respond to emergencies nearby</div>
          </div>
        </button>
      </div>

      <div style={{ fontSize: 13.5, color: T.soft, marginBottom: 32, textAlign: 'center' }}>
        Already registered?{' '}
        <button onClick={() => onSelectFlow('signin')} style={{ background: 'none', border: 'none', color: T.red, fontWeight: 700, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>
          Sign in
        </button>
        {' '}·{' '}
        <button onClick={() => onSelectFlow('admin')} style={{ background: 'none', border: 'none', color: T.soft, fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>
          Coordinator
        </button>
      </div>

      <div style={{ display: 'flex', gap: 28, fontSize: 12, color: T.soft }}>
        <span><b style={{ color: T.ink }}>4,446</b> donors</span>
        <span><b style={{ color: T.ink }}>84</b> active bridges</span>
        <span><b style={{ color: T.ink }}>3,863</b> banks tracked</span>
      </div>
    </div>
  );
}

// ─── AuthFlow (root export) ───────────────────────────────────────────────────

export default function AuthFlow({ onAuth }) {
  const [flow, setFlow] = useState(null); // null | patient-new | donor-new | signin

  const handleComplete = (userId, role) => {
    onAuth(role, userId);
  };

  if (!flow) return <Landing onSelectFlow={(f) => {
    if (f === 'admin') { onAuth('admin', null); return; }
    setFlow(f);
  }} />;

  if (flow === 'patient-new') return <PatientWizard onComplete={handleComplete} onBack={() => setFlow(null)} />;
  if (flow === 'donor-new') return <DonorWizard onComplete={handleComplete} onBack={() => setFlow(null)} />;
  if (flow === 'signin') return <SignIn onVerified={(uid, role) => handleComplete(uid, role)} onBack={() => setFlow(null)} />;

  return null;
}
