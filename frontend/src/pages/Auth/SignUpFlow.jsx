import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../design';

// ─── Design tokens (inline, no Tailwind) ────────────────────────────────────
const T = {
  red: '#e63148',
  navy: '#0a2540',
  bg: '#eef2f7',
  card: '#ffffff',
  ink: '#16202c',
  muted: '#6b7a8d',
  green: '#17b26a',
  amber: '#f5a524',
  border: '#e3e9f0',
  redLight: '#fde8eb',
  greenLight: '#e6f9f0',
  amberLight: '#fef6e4',
  blueLight: '#e8f1fb',
  blue: '#1f5fa6',
  font: "system-ui, -apple-system, sans-serif",
};

// ─── Shared primitives ───────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', prefix, error, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      border: `1.5px solid ${error ? T.red : focus ? T.red : T.border}`,
      borderRadius: 10, background: T.card, overflow: 'hidden',
      boxShadow: focus ? `0 0 0 3px ${error ? '#fde8eb' : '#fde8eb88'}` : 'none',
      transition: 'all .15s',
    }}>
      {prefix && (
        <span style={{ padding: '10px 12px', color: T.muted, fontSize: 14, borderRight: `1px solid ${T.border}`, background: '#f8f9fb', userSelect: 'none' }}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
        style={{
          border: 'none', outline: 'none', flex: 1,
          padding: '11px 14px', fontSize: 14.5, color: T.ink,
          background: 'transparent', fontFamily: T.font,
        }}
      />
    </div>
  );
}

function Select({ value, onChange, children, error }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: '100%', border: `1.5px solid ${error ? T.red : T.border}`,
        borderRadius: 10, padding: '11px 14px', fontSize: 14.5, color: T.ink,
        background: T.card, fontFamily: T.font, outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7a8d' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
      }}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => onChange(!checked)}>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: checked ? T.green : T.border,
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 18, height: 18, borderRadius: 9, background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,.18)', transition: 'left .2s',
        }} />
      </div>
      {label && <span style={{ fontSize: 14, color: T.ink }}>{label}</span>}
    </div>
  );
}

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−', 'Bombay'];

function BloodGroupGrid({ value, onChange }) {
  const [showNote, setShowNote] = useState(false);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {BLOOD_GROUPS.map(g => {
          const sel = value === g;
          return (
            <button
              key={g}
              onClick={() => onChange(g === value ? '' : g)}
              style={{
                padding: '10px 6px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                border: `1.5px solid ${sel ? T.red : T.border}`,
                background: sel ? T.red : T.card,
                color: sel ? '#fff' : T.ink,
                cursor: 'pointer', transition: 'all .15s', fontFamily: T.font,
              }}
            >
              {g}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setShowNote(!showNote)}
        style={{ marginTop: 10, fontSize: 13, color: T.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.font }}
      >
        Not sure of blood group? →
      </button>
      {showNote && (
        <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, background: T.amberLight, border: `1px solid #f5a52440`, fontSize: 13.5, color: '#92540a', lineHeight: 1.5 }}>
          Your nearest blood bank can test for free. You can skip this and add it later.
        </div>
      )}
    </div>
  );
}

function InfoNote({ color = T.amberLight, border = '#f5a52440', textColor = '#92540a', icon = 'info', children }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: color, border: `1px solid ${border}`, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: textColor, lineHeight: 1.55 }}>
      <Icon name={icon} size={16} fill color={textColor} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function PillRadio({ options, value, onChange, color = T.red }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const sel = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600,
              border: `1.5px solid ${sel ? color : T.border}`,
              background: sel ? color : T.card,
              color: sel ? '#fff' : T.ink,
              cursor: 'pointer', transition: 'all .15s', fontFamily: T.font,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < total - 1 ? 1 : 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              background: done ? T.green : active ? T.red : T.border,
              color: (done || active) ? '#fff' : T.muted,
              display: 'grid', placeItems: 'center',
              fontSize: 13, fontWeight: 700,
              transition: 'all .25s',
            }}>
              {done ? <Icon name="check" size={16} color="#fff" /> : step}
            </div>
            {i < total - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: done ? T.green : T.border,
                transition: 'background .3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Location step (shared) ──────────────────────────────────────────────────
function LocationStep({ data, onChange }) {
  const [detected, setDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);

  function detect() {
    setDetecting(true);
    setTimeout(() => {
      setDetecting(false);
      setDetected(true);
      onChange({ ...data, city: 'Hyderabad', district: 'Hyderabad' });
    }, 1400);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Label>Your location</Label>
        <button
          onClick={detect}
          disabled={detecting || detected}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            border: `1.5px solid ${detected ? T.green : T.border}`,
            background: detected ? T.greenLight : T.card,
            color: detected ? T.green : T.ink,
            cursor: detected || detecting ? 'default' : 'pointer',
            fontFamily: T.font, transition: 'all .2s',
          }}
        >
          <Icon name={detected ? 'check_circle' : 'my_location'} size={16} fill color={detected ? T.green : T.muted} />
          {detecting ? 'Detecting…' : detected ? 'Hyderabad, Telangana — detected' : 'Detect my location'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 12, color: T.muted }}>or enter manually</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      <div>
        <Label>City</Label>
        <Input value={data.city || ''} onChange={e => onChange({ ...data, city: e.target.value })} placeholder="e.g. Hyderabad" />
      </div>
      <div>
        <Label>District</Label>
        <Select value={data.district || ''} onChange={e => onChange({ ...data, district: e.target.value })}>
          <option value="">Select district</option>
          {['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>
      <InfoNote icon="lock" color="#f0f4ff" border="#c5d9f380" textColor="#1f5fa6">
        We use your location only to find nearby donors and blood banks. It's never shared publicly.
      </InfoNote>
    </div>
  );
}

// ─── Success animation ───────────────────────────────────────────────────────
function SuccessCheck({ color = T.green }) {
  return (
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: color === T.green ? T.greenLight : T.redLight,
      display: 'grid', placeItems: 'center',
      animation: 'signupCheckPop .4s cubic-bezier(.17,.67,.35,1.3) both',
    }}>
      <style>{`@keyframes signupCheckPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      <Icon name="check_circle" size={40} fill color={color} />
    </div>
  );
}

// ─── PATIENT WIZARD ──────────────────────────────────────────────────────────

function PatientStep1({ data, onChange, errors }) {
  const [forOther, setForOther] = useState(data.forOther || false);
  function update(key, val) { onChange({ ...data, [key]: val }); }
  function toggleForOther(v) { setForOther(v); onChange({ ...data, forOther: v }); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Label required>Full name</Label>
        <Input value={data.name || ''} onChange={e => update('name', e.target.value)} placeholder="Your full name" error={errors?.name} />
      </div>
      <div>
        <Label required>Phone number</Label>
        <Input value={data.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="98765 43210" prefix="+91" type="tel" error={errors?.phone} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: '#fafbfc' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Available on WhatsApp</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>We'll send updates via WhatsApp when possible</div>
        </div>
        <Toggle checked={data.whatsapp !== false} onChange={v => update('whatsapp', v)} />
      </div>
      <div>
        <Label required>Date of birth</Label>
        <Input value={data.dob || ''} onChange={e => update('dob', e.target.value)} type="date" error={errors?.dob} />
      </div>
      <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${T.border}`, background: '#fafbfc' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Who are you registering?</div>
        <PillRadio
          options={['Myself', 'Someone else']}
          value={forOther ? 'Someone else' : 'Myself'}
          onChange={v => toggleForOther(v === 'Someone else')}
        />
      </div>
      {forOther && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', borderRadius: 12, background: T.redLight, border: `1px solid #e6314820` }}>
          <InfoNote icon="child_care" color="transparent" border="transparent" textColor={T.muted}>
            Many patients are children — caregivers can manage their bridge on their behalf.
          </InfoNote>
          <div>
            <Label required>Patient's name</Label>
            <Input value={data.patientName || ''} onChange={e => update('patientName', e.target.value)} placeholder="Patient's full name" />
          </div>
          <div>
            <Label required>Relationship</Label>
            <Select value={data.relationship || ''} onChange={e => update('relationship', e.target.value)}>
              <option value="">Select relationship</option>
              {['Parent', 'Child', 'Sibling', 'Spouse', 'Other family member', 'Caregiver'].map(r => <option key={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <Label>Patient's date of birth</Label>
            <Input value={data.patientDob || ''} onChange={e => update('patientDob', e.target.value)} type="date" />
          </div>
        </div>
      )}
    </div>
  );
}

function PatientStep2({ data, onChange, errors }) {
  function update(key, val) { onChange({ ...data, [key]: val }); }
  const thalType = data.thalType || '';
  const showFreq = thalType === 'Major' || thalType === 'Intermedia';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Label>Blood group</Label>
        <BloodGroupGrid value={data.bloodGroup || ''} onChange={v => update('bloodGroup', v)} />
      </div>
      <div>
        <Label required>Thalassemia type</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { v: 'Major', label: 'Thalassemia Major', desc: 'Regular transfusions every 2–4 weeks' },
            { v: 'Intermedia', label: 'Thalassemia Intermedia', desc: 'Occasional transfusions, varies by condition' },
            { v: 'Minor', label: 'Minor / Trait', desc: 'Carrier — rarely needs transfusions' },
          ].map(opt => {
            const sel = thalType === opt.v;
            return (
              <button
                key={opt.v}
                onClick={() => update('thalType', opt.v)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                  border: `2px solid ${sel ? T.red : T.border}`,
                  background: sel ? T.redLight : T.card,
                  cursor: 'pointer', transition: 'all .15s', fontFamily: T.font,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14.5, color: sel ? T.red : T.ink }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
      {showFreq && (
        <div>
          <Label required>Transfusion frequency</Label>
          <Select value={data.transfusionFreq || ''} onChange={e => update('transfusionFreq', e.target.value)} error={errors?.transfusionFreq}>
            <option value="">Select frequency</option>
            <option>Every 2 weeks</option>
            <option>Every 3 weeks</option>
            <option>Monthly</option>
            <option>Varies</option>
          </Select>
        </div>
      )}
      <div>
        <Label>Last transfusion date (optional)</Label>
        <Input value={data.lastTransfusion || ''} onChange={e => update('lastTransfusion', e.target.value)} type="date" />
      </div>
    </div>
  );
}

function PatientStep4({ data, onChange, errors }) {
  function update(key, val) { onChange({ ...data, [key]: val }); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Label required>Emergency contact name</Label>
        <Input value={data.ecName || ''} onChange={e => update('ecName', e.target.value)} placeholder="Full name" error={errors?.ecName} />
      </div>
      <div>
        <Label required>Emergency contact phone</Label>
        <Input value={data.ecPhone || ''} onChange={e => update('ecPhone', e.target.value)} placeholder="98765 43210" prefix="+91" type="tel" error={errors?.ecPhone} />
      </div>
      <div>
        <Label required>Relationship to patient</Label>
        <Select value={data.ecRelation || ''} onChange={e => update('ecRelation', e.target.value)} error={errors?.ecRelation}>
          <option value="">Select relationship</option>
          {['Parent', 'Spouse', 'Sibling', 'Child', 'Friend', 'Caregiver', 'Other'].map(r => <option key={r}>{r}</option>)}
        </Select>
      </div>
      <div>
        <Label>Preferred language</Label>
        <PillRadio options={['English', 'Hindi', 'Telugu']} value={data.language || 'English'} onChange={v => update('language', v)} color={T.red} />
      </div>
    </div>
  );
}

function PatientSuccess({ formData, onComplete }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <SuccessCheck color={T.red} />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: T.ink, marginBottom: 10 }}>
        Your blood bridge is being built
      </h2>
      <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 24px' }}>
        We're finding compatible donors near you. You'll get a WhatsApp message when your first donor confirms.
      </p>
      <div style={{ padding: '18px 20px', borderRadius: 14, border: `1px solid ${T.border}`, background: '#fafbfc', marginBottom: 24 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Your bridge</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#f0f2f5', border: `1.5px solid ${T.border}`,
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="person" size={22} color={T.border} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13.5, color: T.muted }}>
          <span style={{ fontWeight: 700, color: T.ink }}>0 of 8</span> donors confirmed <span style={{ color: T.amber }}>· searching…</span>
        </div>
      </div>
      <button
        onClick={() => onComplete('patient', formData)}
        style={{
          width: '100%', padding: '14px', borderRadius: 12, fontSize: 15.5, fontWeight: 700,
          background: T.red, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: T.font,
        }}
      >
        Go to my dashboard →
      </button>
    </div>
  );
}

// ─── DONOR WIZARD ────────────────────────────────────────────────────────────

function getAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getEligibleDate(lastDonation) {
  if (!lastDonation) return null;
  const d = new Date(lastDonation);
  d.setDate(d.getDate() + 90);
  return d;
}

function DonorStep1({ data, onChange, errors }) {
  function update(key, val) { onChange({ ...data, [key]: val }); }
  const age = getAge(data.dob);
  const underAge = age !== null && age < 18;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <Label required>Full name</Label>
        <Input value={data.name || ''} onChange={e => update('name', e.target.value)} placeholder="Your full name" error={errors?.name} />
      </div>
      <div>
        <Label required>Phone number</Label>
        <Input value={data.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="98765 43210" prefix="+91" type="tel" error={errors?.phone} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: '#fafbfc' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Available on WhatsApp</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>We'll coordinate donation requests via WhatsApp</div>
        </div>
        <Toggle checked={data.whatsapp !== false} onChange={v => update('whatsapp', v)} />
      </div>
      <div>
        <Label required>Date of birth</Label>
        <Input value={data.dob || ''} onChange={e => update('dob', e.target.value)} type="date" error={errors?.dob} />
      </div>
      {underAge && (
        <InfoNote color={T.amberLight} border="#f5a52440" textColor="#92540a" icon="child_care">
          Donors must be 18 or older. Know an adult who'd like to help? Share ThalNet with them →
        </InfoNote>
      )}
      <div>
        <Label required>Gender</Label>
        <PillRadio options={['Male', 'Female', 'Other']} value={data.gender || ''} onChange={v => update('gender', v)} color={T.green} />
      </div>
    </div>
  );
}

const DISTANCE_STEPS = ['5 km', '10 km', '25 km', '50 km', '100 km+'];

function DonorStep2({ data, onChange, errors }) {
  function update(key, val) { onChange({ ...data, [key]: val }); }
  const weight = parseFloat(data.weight);
  const lowWeight = data.weight && weight < 50;
  const lastDonation = data.lastDonation;
  const neverDonated = data.neverDonated;
  const eligDate = getEligibleDate(lastDonation);
  const withinWindow = eligDate && eligDate > new Date();
  const donorTypes = data.donorTypes || [];
  const toggleDonorType = (t) => {
    const next = donorTypes.includes(t) ? donorTypes.filter(x => x !== t) : [...donorTypes, t];
    update('donorTypes', next);
  };
  const health = data.health || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Label>Blood group</Label>
        <BloodGroupGrid value={data.bloodGroup || ''} onChange={v => update('bloodGroup', v)} />
      </div>
      <div>
        <Label required>Weight (kg)</Label>
        <Input value={data.weight || ''} onChange={e => update('weight', e.target.value)} placeholder="e.g. 65" type="number" error={errors?.weight} />
        {lowWeight && (
          <div style={{ marginTop: 8 }}>
            <InfoNote icon="monitor_weight">
              Current guidelines require 50 kg minimum. You can still register — we'll check again when a request comes in.
            </InfoNote>
          </div>
        )}
      </div>
      <div>
        <Label>Last donation date</Label>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }} onClick={() => update('neverDonated', !neverDonated)}>
          <div style={{
            width: 18, height: 18, borderRadius: 5, border: `2px solid ${neverDonated ? T.green : T.border}`,
            background: neverDonated ? T.green : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {neverDonated && <Icon name="check" size={12} color="#fff" />}
          </div>
          <span style={{ fontSize: 14, color: T.ink }}>I've never donated before</span>
        </div>
        {!neverDonated && (
          <Input value={data.lastDonation || ''} onChange={e => update('lastDonation', e.target.value)} type="date" />
        )}
        {withinWindow && (
          <div style={{ marginTop: 8 }}>
            <InfoNote icon="check_circle" color={T.greenLight} border="#17b26a30" textColor="#0a6b40">
              You donated recently — eligible again on{' '}
              <strong>{eligDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              We'll reach out when you're ready.
            </InfoNote>
          </div>
        )}
      </div>
      <div>
        <Label>Donor type</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { v: 'bridge', label: 'Bridge donor', desc: "Join a patient's team of 8. Donate every 3–4 months.", accent: T.green, accentLight: T.greenLight },
            { v: 'emergency', label: 'Emergency only', desc: "Get urgent notifications only. Donate when it's critical.", accent: T.amber, accentLight: T.amberLight },
          ].map(opt => {
            const sel = donorTypes.includes(opt.v);
            return (
              <button
                key={opt.v}
                onClick={() => toggleDonorType(opt.v)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                  border: `2px solid ${sel ? opt.accent : T.border}`,
                  background: sel ? opt.accentLight : T.card,
                  cursor: 'pointer', transition: 'all .15s', fontFamily: T.font,
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? opt.accent : T.border}`,
                  background: sel ? opt.accent : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  {sel && <Icon name="check" size={12} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: sel ? opt.accent : T.ink }}>{opt.label}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '16px', borderRadius: 12, border: `1px solid ${T.border}`, background: '#fafbfc' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, marginBottom: 14 }}>Quick health check</div>
        {[
          { k: 'recent_illness', label: 'Have you had any illness in the past 2 weeks?' },
          { k: 'medication', label: 'Are you currently on any regular medication?' },
          { k: 'surgery', label: 'Any surgery or major procedure in the past 6 months?' },
        ].map(item => {
          const yes = health[item.k];
          return (
            <div key={item.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: T.ink, flex: 1, paddingRight: 12 }}>{item.label}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Yes', 'No'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => update('health', { ...health, [item.k]: opt === 'Yes' })}
                    style={{
                      padding: '5px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${yes === (opt === 'Yes') ? (opt === 'Yes' ? T.amber : T.green) : T.border}`,
                      background: yes === (opt === 'Yes') ? (opt === 'Yes' ? T.amberLight : T.greenLight) : T.card,
                      color: yes === (opt === 'Yes') ? (opt === 'Yes' ? '#92540a' : T.green) : T.muted,
                      cursor: 'pointer', fontFamily: T.font, transition: 'all .15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {Object.values(health).some(v => v === true) && (
          <InfoNote icon="info">
            No worries — the blood bank will do a full medical screening before your donation. Please bring this up during screening.
          </InfoNote>
        )}
      </div>
    </div>
  );
}

function DonorStep3({ data, onChange }) {
  function update(key, val) { onChange({ ...data, [key]: val }); }
  const distIdx = data.distIdx ?? 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <LocationStep data={data} onChange={onChange} />
      <div>
        <Label>Preferred contact method</Label>
        <PillRadio options={['WhatsApp', 'SMS', 'Phone call']} value={data.contactPref || 'WhatsApp'} onChange={v => update('contactPref', v)} color={T.green} />
      </div>
      <div>
        <Label>Preferred language</Label>
        <PillRadio options={['English', 'Hindi', 'Telugu']} value={data.language || 'English'} onChange={v => update('language', v)} color={T.green} />
      </div>
      <div>
        <Label>How far will you travel to donate?</Label>
        <div style={{ padding: '16px', borderRadius: 12, border: `1px solid ${T.border}`, background: '#fafbfc' }}>
          <input
            type="range" min={0} max={4} step={1} value={distIdx}
            onChange={e => update('distIdx', Number(e.target.value))}
            style={{ width: '100%', accentColor: T.green, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {DISTANCE_STEPS.map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, color: i === distIdx ? T.green : T.muted, fontWeight: i === distIdx ? 700 : 400, transition: 'color .15s' }}>{s}</span>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 15, fontWeight: 700, color: T.green }}>
            {DISTANCE_STEPS[distIdx]}
          </div>
        </div>
      </div>
    </div>
  );
}

function DonorSuccess({ formData, onComplete }) {
  const eligDate = getEligibleDate(formData.lastDonation);
  const withinWindow = !formData.neverDonated && eligDate && eligDate > new Date();

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <SuccessCheck color={T.green} />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', color: T.ink, marginBottom: 10 }}>
        You're in the network
      </h2>
      <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 20px' }}>
        {withinWindow
          ? <>You donated recently. We'll match you when you're eligible again on <strong style={{ color: T.ink }}>{eligDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</strong>.</>
          : "You're eligible to donate now. We'll match you with a patient nearby when the time comes."}
      </p>
      <div style={{ padding: '14px 16px', borderRadius: 12, background: T.greenLight, border: `1px solid #17b26a30`, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Icon name="check_circle" size={20} fill color={T.green} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0a6b40' }}>Registration complete</div>
          <div style={{ fontSize: 13, color: '#0a6b40', opacity: 0.8 }}>You'll receive a WhatsApp or SMS when a patient needs your blood type nearby.</div>
        </div>
      </div>
      <button
        onClick={() => onComplete('donor', formData)}
        style={{
          width: '100%', padding: '14px', borderRadius: 12, fontSize: 15.5, fontWeight: 700,
          background: T.green, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: T.font,
        }}
      >
        View my dashboard →
      </button>
    </div>
  );
}

// ─── Role picker ─────────────────────────────────────────────────────────────

function RolePickerCard({ title, subtitle, accent, icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 240px', background: T.card, borderRadius: 14,
        border: `1px solid ${hovered ? accent : T.border}`,
        borderLeft: `4px solid ${accent}`,
        padding: '22px 20px', cursor: 'pointer',
        boxShadow: hovered ? '0 8px 28px rgba(20,20,30,.10)' : '0 1px 3px rgba(20,20,30,.05)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all .2s ease',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 12, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 17, color: T.ink, letterSpacing: '-.02em' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: T.muted, marginTop: 6, lineHeight: 1.55 }}>{subtitle}</div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: accent }}>
        {label}
        <span style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform .18s', display: 'inline-block' }}>→</span>
      </div>
    </div>
  );
}

// ─── Main wizard shell ────────────────────────────────────────────────────────

const PATIENT_STEP_LABELS = ['About You', 'Medical Details', 'Location', 'Emergency Contact'];
const DONOR_STEP_LABELS  = ['About You', 'Donation Details', 'Location & Preferences'];

// screen: 0 = role picker, 1–4 = patient, 11–13 = donor, 99/100 = success
export default function SignUpFlow({ onComplete, onBack }) {
  const [screen, setScreen] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const scrollRef = useRef(null);

  function scrollTop() {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  function go(s) { setErrors({}); setScreen(s); scrollTop(); }

  // ── Patient navigation ──
  const isPatient = screen >= 1 && screen <= 5;
  const isPatientSuccess = screen === 5;
  const patientStep = isPatient ? screen : null;

  // ── Donor navigation ──
  const isDonor = screen >= 11 && screen <= 14;
  const isDonorSuccess = screen === 14;
  const donorStep = isDonor ? screen - 10 : null;

  function validatePatient(step) {
    const e = {};
    if (step === 1) {
      if (!formData.name?.trim()) e.name = true;
      if (!formData.phone?.trim()) e.phone = true;
      if (!formData.dob) e.dob = true;
    }
    if (step === 2) {
      if (!formData.thalType) e.thalType = true;
    }
    if (step === 4) {
      if (!formData.ecName?.trim()) e.ecName = true;
      if (!formData.ecPhone?.trim()) e.ecPhone = true;
      if (!formData.ecRelation) e.ecRelation = true;
    }
    return e;
  }

  function validateDonor(step) {
    const e = {};
    if (step === 1) {
      if (!formData.name?.trim()) e.name = true;
      if (!formData.phone?.trim()) e.phone = true;
      if (!formData.dob) e.dob = true;
      if (!formData.gender) e.gender = true;
    }
    if (step === 2) {
      if (!formData.weight) e.weight = true;
    }
    return e;
  }

  function nextPatient() {
    const e = validatePatient(patientStep);
    if (Object.keys(e).length) { setErrors(e); return; }
    go(screen + 1);
  }

  function nextDonor() {
    const e = validateDonor(donorStep);
    if (Object.keys(e).length) { setErrors(e); return; }
    go(screen + 1);
  }

  function backPatient() {
    if (screen === 1) go(0); else go(screen - 1);
  }

  function backDonor() {
    if (screen === 11) go(0); else go(screen - 1);
  }

  const containerStyle = {
    minHeight: '100vh', background: T.bg,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '32px 16px 48px', fontFamily: T.font,
  };

  const cardStyle = {
    background: T.card, borderRadius: 18,
    boxShadow: '0 4px 20px rgba(20,20,30,.08), 0 1px 3px rgba(20,20,30,.04)',
    width: '100%', maxWidth: 520, overflow: 'hidden',
  };

  // ── Header ──
  function Header({ title, subtitle }) {
    return (
      <div style={{ padding: '28px 28px 0' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: T.red, display: 'grid', placeItems: 'center' }}>
            <Icon name="water_drop" size={15} fill color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: T.ink }}>
            Thal<span style={{ color: T.red }}>Net</span>
          </span>
        </div>
        {title && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: T.ink }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 14, color: T.muted, marginTop: 6, lineHeight: 1.55 }}>{subtitle}</p>}
          </>
        )}
      </div>
    );
  }

  // ── Role picker ──────────────────────────────────────────────
  if (screen === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, maxWidth: 820 }} ref={scrollRef}>
          <Header />
          <div style={{ padding: '4px 28px 28px' }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.025em', color: T.ink, marginBottom: 6 }}>
              Who are you joining as?
            </h2>
            <p style={{ fontSize: 14.5, color: T.muted, marginBottom: 24, lineHeight: 1.55 }}>
              Choose your role to get started. You can always switch later.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
              <RolePickerCard
                title="I'm a patient or caregiver"
                subtitle="Build your blood bridge — a reliable team of donors around you"
                accent={T.red}
                icon="❤️"
                label="I need support"
                onClick={() => go(1)}
              />
              <RolePickerCard
                title="I'm a donor"
                subtitle="Join a patient's bridge or respond to emergencies nearby"
                accent={T.green}
                icon="🩸"
                label="I want to donate"
                onClick={() => go(11)}
              />
              <RolePickerCard
                title="Admin / Coordinator"
                subtitle="Operations view — bridges, supply, agent log"
                accent={T.blue}
                icon="⊞"
                label="Open dashboard"
                onClick={() => onComplete('admin', {})}
              />
            </div>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <button
                onClick={onBack}
                style={{ fontSize: 13.5, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.font, padding: 0 }}
              >
                Already registered? Sign in →
              </button>
              <div style={{ fontSize: 12.5, color: T.muted }}>
                4,446 donors · 84 active patients · 3,863 blood banks tracked
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Patient wizard ────────────────────────────────────────────
  if (isPatient) {
    const stepTitle = PATIENT_STEP_LABELS[(patientStep || 1) - 1] || '';
    const stepSubtitles = [
      'Tell us a little about who this bridge is for.',
      'This helps us find the right blood type and plan around your schedule.',
      'We find donors and blood banks nearest to you.',
      "In case of an emergency, who should we call?",
    ];

    if (isPatientSuccess) {
      return (
        <div style={containerStyle}>
          <div style={cardStyle} ref={scrollRef}>
            <div style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: T.red, display: 'grid', placeItems: 'center' }}>
                  <Icon name="water_drop" size={15} fill color="#fff" />
                </div>
                <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: T.ink }}>
                  Thal<span style={{ color: T.red }}>Net</span>
                </span>
              </div>
              <PatientSuccess formData={formData} onComplete={onComplete} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={containerStyle}>
        <div style={cardStyle} ref={scrollRef}>
          <Header title={stepTitle} subtitle={stepSubtitles[(patientStep || 1) - 1]} />
          <div style={{ padding: '20px 28px 28px' }}>
            <ProgressBar current={patientStep || 1} total={4} />
            {patientStep === 1 && <PatientStep1 data={formData} onChange={setFormData} errors={errors} />}
            {patientStep === 2 && <PatientStep2 data={formData} onChange={setFormData} errors={errors} />}
            {patientStep === 3 && <LocationStep data={formData} onChange={setFormData} />}
            {patientStep === 4 && <PatientStep4 data={formData} onChange={setFormData} errors={errors} />}
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button
                onClick={backPatient}
                style={{
                  flex: '0 0 auto', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${T.border}`, background: T.card, color: T.ink,
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >
                ← Back
              </button>
              <button
                onClick={patientStep === 4 ? nextPatient : nextPatient}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  background: T.red, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: T.font,
                }}
              >
                {patientStep === 4 ? 'Create my blood bridge' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Donor wizard ──────────────────────────────────────────────
  if (isDonor) {
    const stepTitle = DONOR_STEP_LABELS[(donorStep || 1) - 1] || '';
    const stepSubtitles = [
      'Tell us a bit about yourself.',
      'Your donation details help us match you to the right patients.',
      'Where are you based, and how would you like us to reach you?',
    ];

    if (isDonorSuccess) {
      return (
        <div style={containerStyle}>
          <div style={cardStyle} ref={scrollRef}>
            <div style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: T.red, display: 'grid', placeItems: 'center' }}>
                  <Icon name="water_drop" size={15} fill color="#fff" />
                </div>
                <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: T.ink }}>
                  Thal<span style={{ color: T.red }}>Net</span>
                </span>
              </div>
              <DonorSuccess formData={formData} onComplete={onComplete} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={containerStyle}>
        <div style={cardStyle} ref={scrollRef}>
          <Header title={stepTitle} subtitle={stepSubtitles[(donorStep || 1) - 1]} />
          <div style={{ padding: '20px 28px 28px' }}>
            <ProgressBar current={donorStep || 1} total={3} />
            {donorStep === 1 && <DonorStep1 data={formData} onChange={setFormData} errors={errors} />}
            {donorStep === 2 && <DonorStep2 data={formData} onChange={setFormData} errors={errors} />}
            {donorStep === 3 && <DonorStep3 data={formData} onChange={setFormData} />}
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button
                onClick={backDonor}
                style={{
                  flex: '0 0 auto', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${T.border}`, background: T.card, color: T.ink,
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >
                ← Back
              </button>
              <button
                onClick={nextDonor}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  background: T.green, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: T.font,
                }}
              >
                {donorStep === 3 ? 'Join the network' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
