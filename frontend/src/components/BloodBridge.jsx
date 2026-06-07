import { useState, useRef, useCallback } from 'react';

/* ─── Design tokens ──────────────────────────────────────────────── */
const C = {
  red:      '#e63148',
  navy:     '#0a2540',
  green:    '#17b26a',
  amber:    '#f5a524',
  redErr:   '#e5484d',
  gray:     '#d1d5db',
  muted:    '#6b7a8d',
  border:   '#e3e9f0',
  greenBg:  '#ecfdf5',
  amberBg:  '#fffbeb',
  redBg:    '#fef2f2',
};

/* ─── Status config ──────────────────────────────────────────────── */
const STATUS = {
  confirmed: { border: C.green,  fill: C.greenBg, label: 'Confirmed', solid: true  },
  scheduled: { border: C.green,  fill: '#ffffff',  label: 'Scheduled', solid: true  },
  awaiting:  { border: C.amber,  fill: C.amberBg,  label: 'Awaiting',  solid: false, pulse: true },
  resting:   { border: C.gray,   fill: '#f9fafb',  label: 'Resting',   solid: false },
  lapsed:    { border: C.redErr, fill: C.redBg,    label: 'Lapsed',    solid: false },
  open:      { border: C.gray,   fill: '#f3f4f6',  label: 'Open slot', solid: false, open: true },
};

/* ─── Sample data ────────────────────────────────────────────────── */
const SAMPLE_PATIENT = { name: 'Anaya R.', blood_group: 'O+', target_size: 8 };
const SAMPLE_DONORS = [
  { id: 1, name: 'Ravi T.',     initials: 'RT', status: 'confirmed' },
  { id: 2, name: 'Sneha R.',    initials: 'SR', status: 'scheduled', date: 'Jun 12' },
  { id: 3, name: 'Meghana R.', initials: 'MR', status: 'awaiting'  },
  { id: 4, name: 'Imran K.',    initials: 'IK', status: 'confirmed' },
  { id: 5, name: 'Sai K.',      initials: 'SK', status: 'lapsed'    },
  { id: 6, name: 'Anjali N.',   initials: 'AN', status: 'confirmed' },
  { id: 7, name: 'Pooja S.',    initials: 'PS', status: 'resting'   },
  { id: 8, name: 'Karthik V.', initials: 'KV', status: 'confirmed' },
];

/* ─── Geometry helpers ───────────────────────────────────────────── */
const SVG_SIZE   = 340;
const CENTER     = SVG_SIZE / 2;
const ORBIT_R    = 120;
const PATIENT_R  = 40;
const DONOR_R    = 25;
const RING_R     = 50;

function polarToXY(angleDeg, radius, cx = CENTER, cy = CENTER) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  if (endAngle <= startAngle) return '';
  const clamp = Math.min(endAngle - startAngle, 359.999);
  const s = polarToXY(startAngle, r, cx, cy);
  const e = polarToXY(startAngle + clamp, r, cx, cy);
  const large = clamp > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function edgePoint(fromX, fromY, toX, toY, r) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: fromX + (dx / len) * r, y: fromY + (dy / len) * r };
}

/* ─── Subcomponents ──────────────────────────────────────────────── */

function PatientNode({ patient, cx, cy }) {
  const initials = patient.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <g>
      <circle cx={cx} cy={cy} r={PATIENT_R + 6} fill="white" opacity={0.6} />
      <circle cx={cx} cy={cy} r={PATIENT_R} fill="white" stroke={C.red} strokeWidth={3} />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="700" fontSize={24} fill={C.navy}
      >
        {initials}
      </text>
    </g>
  );
}

function CompletenessRing({ donors, targetSize, cx, cy }) {
  const active = donors.filter(d => d && (d.status === 'confirmed' || d.status === 'scheduled')).length;
  const pct = targetSize > 0 ? Math.min(active / targetSize, 1) : 0;
  const filledEnd = pct * 360;

  return (
    <g>
      <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke={C.border} strokeWidth={5} strokeDasharray="4 3" />
      {pct > 0 && (
        <path d={arcPath(cx, cy, RING_R, 0, filledEnd)} fill="none" stroke={C.green} strokeWidth={5} strokeLinecap="round" />
      )}
    </g>
  );
}

function DonorNode({ slot, angle, onSelect, selected }) {
  const pos = polarToXY(angle, ORBIT_R);
  const cfg = slot ? STATUS[slot.status] || STATUS.open : STATUS.open;
  const isOpen = !slot || cfg.open;

  return (
    <g style={{ cursor: isOpen ? 'default' : 'pointer' }} onClick={() => !isOpen && onSelect(slot)}>
      {cfg.pulse && (
        <circle cx={pos.x} cy={pos.y} r={DONOR_R + 6} fill="none" stroke={C.amber} strokeWidth={2} opacity={0.35}
          style={{ animation: 'pulse-ring 2s ease-in-out infinite' }} />
      )}
      <g className={!isOpen ? 'donor-node' : ''} style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}>
        <circle cx={pos.x} cy={pos.y} r={DONOR_R} fill={cfg.fill} stroke={cfg.border} strokeWidth={2.5} />
        {isOpen ? (
          <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
            fontFamily="system-ui, sans-serif" fontSize={18} fill={C.gray} fontWeight="600">+</text>
        ) : (
          <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
            fontFamily="system-ui, sans-serif" fontWeight="700" fontSize={13} fill={C.navy}>
            {slot.initials}
          </text>
        )}
      </g>
      {selected && (
        <circle cx={pos.x} cy={pos.y} r={DONOR_R + 4} fill="none" stroke={cfg.border} strokeWidth={2} opacity={0.6} />
      )}
    </g>
  );
}

function ConnectionLine({ slot, angle }) {
  const donorPos = polarToXY(angle, ORBIT_R);
  const cfg = slot ? STATUS[slot.status] || STATUS.open : STATUS.open;
  const fromEdge = edgePoint(donorPos.x, donorPos.y, CENTER, CENTER, DONOR_R + 2);
  const toEdge   = edgePoint(CENTER, CENTER, donorPos.x, donorPos.y, PATIENT_R + 2);

  return (
    <line x1={fromEdge.x} y1={fromEdge.y} x2={toEdge.x} y2={toEdge.y}
      stroke={cfg.border} strokeWidth={1.5} strokeDasharray={cfg.solid ? 'none' : '4 3'} opacity={0.75} />
  );
}

function DonorLabel({ slot, angle }) {
  const labelR = ORBIT_R + DONOR_R + 10;
  const labelPos = polarToXY(angle, labelR);
  const normAngle = ((angle % 360) + 360) % 360;
  let anchor = 'middle';
  if (normAngle > 15 && normAngle < 165) anchor = 'start';
  else if (normAngle > 195 && normAngle < 345) anchor = 'end';

  if (!slot) return null;

  const words = slot.name.split(' ');
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');

  return (
    <g>
      <text x={labelPos.x} y={labelPos.y} textAnchor={anchor}
        fontFamily="system-ui, sans-serif" fontSize={10} fill={C.navy} fontWeight="500">{line1}</text>
      {line2 && (
        <text x={labelPos.x} y={labelPos.y + 13} textAnchor={anchor}
          fontFamily="system-ui, sans-serif" fontSize={10} fill={C.navy} fontWeight="500">{line2}</text>
      )}
    </g>
  );
}

function Popover({ donor, svgRef, angle, onHeal, onClose }) {
  if (!donor || !svgRef.current) return null;
  const cfg = STATUS[donor.status] || STATUS.open;
  const svgRect = svgRef.current.getBoundingClientRect();
  const scale = svgRect.width / SVG_SIZE;
  const pos = polarToXY(angle, ORBIT_R);
  let px = pos.x * scale;
  let py = pos.y * scale;
  const normAngle = ((angle % 360) + 360) % 360;
  let offsetX = 0, offsetY = -90;
  if (normAngle > 30 && normAngle < 150) { offsetX = 80; offsetY = -30; }
  else if (normAngle > 210 && normAngle < 330) { offsetX = -180; offsetY = -30; }
  else if (normAngle >= 150 && normAngle <= 210) { offsetY = 20; }
  px = Math.max(0, Math.min(px + offsetX, svgRect.width - 170));
  py = Math.max(0, Math.min(py + offsetY, svgRect.height - 160));

  return (
    <div style={{ position: 'absolute', left: px, top: py, width: 164, background: 'white',
      border: `1.5px solid ${C.border}`, borderRadius: 10,
      boxShadow: '0 8px 24px rgba(10,37,64,0.13)', padding: '12px 14px', zIndex: 20, pointerEvents: 'auto' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, lineHeight: 1.3 }}>{donor.name}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: C.muted, fontSize: 16, padding: 0, lineHeight: 1 }} aria-label="Close">×</button>
      </div>
      {donor.blood_group && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{donor.blood_group}</div>}
      <div style={{ marginTop: 8 }}>
        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: cfg.border,
          background: cfg.fill, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '2px 9px' }}>
          {cfg.label}
        </span>
      </div>
      {donor.date && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
          {donor.status === 'scheduled' ? 'Scheduled: ' : 'Date: '}{donor.date}
        </div>
      )}
      {donor.status === 'lapsed' && (
        <button onClick={() => { onHeal && onHeal(donor); onClose(); }}
          style={{ marginTop: 10, width: '100%', fontSize: 12, fontWeight: 600, color: C.amber,
            background: 'transparent', border: `1.5px solid ${C.amber}`, borderRadius: 7,
            padding: '5px 0', cursor: 'pointer' }}>
          Self-heal ↺
        </button>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function BloodBridge({ patient = SAMPLE_PATIENT, donors = SAMPLE_DONORS, onHeal }) {
  const [selectedId, setSelectedId] = useState(null);
  const svgRef = useRef(null);
  const targetSize = patient.target_size || 8;
  const slots = Array.from({ length: targetSize }, (_, i) => donors[i] || null);

  const counts = {};
  slots.forEach(s => { const key = s ? s.status : 'open'; counts[key] = (counts[key] || 0) + 1; });

  const confirmedCount = counts.confirmed || 0;
  const scheduledCount = counts.scheduled || 0;
  const awaitingCount  = counts.awaiting  || 0;
  const restingCount   = counts.resting   || 0;
  const lapsedCount    = counts.lapsed    || 0;
  const openCount      = counts.open      || 0;

  const selectedDonor = selectedId ? slots.find(s => s && s.id === selectedId) : null;
  const selectedAngle = selectedDonor ? (slots.indexOf(selectedDonor) / targetSize) * 360 : 0;

  const handleSelect = useCallback(donor => setSelectedId(prev => prev === donor.id ? null : donor.id), []);
  const handleClose  = useCallback(() => setSelectedId(null), []);

  const allFilled = openCount === 0 && lapsedCount === 0;
  const hasLapsed = lapsedCount > 0;
  const hasOpen   = openCount > 0;

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.2; r: ${DONOR_R + 4}; }
          50%       { opacity: 0.5; r: ${DONOR_R + 8}; }
        }
        .donor-node { transition: transform 0.18s ease; transform-box: fill-box; }
        .donor-node:hover { transform: scale(1.12); }
      `}</style>

      <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${C.border}`,
        padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 400,
        boxShadow: '0 4px 20px rgba(10,37,64,0.07)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            The Blood Bridge
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.greenBg,
            border: `1px solid ${C.green}`, borderRadius: 20, padding: '3px 10px', letterSpacing: '0.03em' }}>
            self-healing
          </span>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} onClick={handleClose}>
          <svg ref={svgRef} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width={SVG_SIZE} height={SVG_SIZE}
            style={{ maxWidth: '100%', overflow: 'visible', display: 'block' }} aria-label="Blood bridge radial map">
            {slots.map((slot, i) => <ConnectionLine key={`line-${i}`} slot={slot} angle={(i / targetSize) * 360} />)}
            <CompletenessRing donors={slots} targetSize={targetSize} cx={CENTER} cy={CENTER} />
            <PatientNode patient={patient} cx={CENTER} cy={CENTER} />
            <text x={CENTER} y={CENTER + PATIENT_R + 15} textAnchor="middle"
              fontFamily="system-ui, sans-serif" fontSize={12} fill={C.muted}>{patient.name}</text>
            <g>
              <rect x={CENTER - 14} y={CENTER + PATIENT_R + 22} width={28} height={17} rx={8}
                fill={C.redBg} stroke={C.red} strokeWidth={1} />
              <text x={CENTER} y={CENTER + PATIENT_R + 33} textAnchor="middle"
                fontFamily="system-ui, sans-serif" fontSize={11} fontWeight={700} fill={C.red}>
                {patient.blood_group}
              </text>
            </g>
            <text x={CENTER} y={CENTER + PATIENT_R + 50} textAnchor="middle"
              fontFamily="system-ui, sans-serif" fontSize={11} fill={C.muted}>{targetSize} donors needed</text>
            {slots.map((slot, i) => {
              const angle = (i / targetSize) * 360;
              return (
                <g key={`donor-${i}`}>
                  <DonorLabel slot={slot} angle={angle} />
                  <DonorNode slot={slot} angle={angle} onSelect={handleSelect} selected={slot && slot.id === selectedId} />
                </g>
              );
            })}
          </svg>
          {selectedDonor && (
            <Popover donor={selectedDonor} svgRef={svgRef} angle={selectedAngle} onHeal={onHeal} onClose={handleClose} />
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', marginTop: 18, fontSize: 12, color: C.muted }}>
          {confirmedCount > 0 && <span><span style={{ color: C.green }}>●</span> {confirmedCount} Confirmed</span>}
          {scheduledCount > 0 && <span><span style={{ color: C.green, opacity: 0.6 }}>●</span> {scheduledCount} Scheduled</span>}
          {awaitingCount  > 0 && <span><span style={{ color: C.amber }}>●</span> {awaitingCount} Awaiting</span>}
          {restingCount   > 0 && <span><span style={{ color: C.gray }}>●</span> {restingCount} Resting</span>}
          {lapsedCount    > 0 && <span><span style={{ color: C.redErr }}>●</span> {lapsedCount} Lapsed</span>}
          {openCount      > 0 && <span><span style={{ color: C.gray }}>●</span> {openCount} Open</span>}
        </div>

        <div style={{ marginTop: 14, borderRadius: 9, padding: '10px 14px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 500,
          ...(allFilled ? { background: C.greenBg, color: '#065f46' }
            : hasLapsed  ? { background: C.amberBg, color: '#92400e' }
            : { background: '#f9fafb', color: C.muted }) }}>
          {allFilled && <span>Bridge is complete ✓</span>}
          {!allFilled && hasLapsed && (
            <>
              <span>Bridge needs attention — {lapsedCount} donor{lapsedCount > 1 ? 's' : ''} lapsed</span>
              <button onClick={() => onHeal && onHeal()}
                style={{ marginLeft: 12, fontSize: 12, fontWeight: 600, color: C.amber,
                  background: 'transparent', border: `1.5px solid ${C.amber}`, borderRadius: 7,
                  padding: '4px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Self-heal ↺
              </button>
            </>
          )}
          {!allFilled && !hasLapsed && hasOpen && <span>Finding donors…</span>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 14, fontSize: 11, color: C.muted }}>
          {Object.entries(STATUS).map(([key, cfg]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                background: cfg.fill, border: `1.5px solid ${cfg.border}` }} />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
