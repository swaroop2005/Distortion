/* ThalNet — shared UI primitives. Exported to window for cross-file use. */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- status system ---------- */
const STATUS = {
  confirmed: { label: "Confirmed", fg: "var(--green-600)", bg: "var(--green-100)", dot: "var(--green-500)" },
  scheduled: { label: "Scheduled", fg: "var(--green-600)", bg: "var(--green-50)",  dot: "var(--green-500)" },
  contacted: { label: "Contacted", fg: "var(--amber-600)", bg: "var(--amber-100)", dot: "var(--amber-500)" },
  resting:   { label: "Resting",   fg: "var(--muted)",     bg: "var(--line-soft)", dot: "var(--faint)" },
  lapsed:    { label: "Lapsed",    fg: "var(--red-600)",   bg: "var(--red-100)",   dot: "var(--red-500)" },
  empty:     { label: "Open slot", fg: "var(--faint)",     bg: "transparent",      dot: "var(--line)" },
};
const HEALTH = {
  full:      { label: "Full",    fg: "var(--green-600)", bg: "var(--green-100)", dot: "var(--green-500)" },
  "at-risk": { label: "At risk", fg: "var(--amber-600)", bg: "var(--amber-100)", dot: "var(--amber-500)" },
  broken:    { label: "Broken",  fg: "var(--red-600)",   bg: "var(--red-100)",   dot: "var(--red-500)" },
};

/* ---------- Icon ---------- */
function Icon({ name, size = 20, fill = false, color, style, className = "" }) {
  return (
    <span
      className={"ms" + (fill ? " fill" : "") + (className ? " " + className : "")}
      style={{ fontSize: size, color, ...style }}
    >{name}</span>
  );
}

/* ---------- Button ---------- */
function Button({ children, variant = "primary", size = "md", icon, iconRight, full, onClick, style, type, disabled }) {
  const [hover, setHover] = useState(false);
  const sizes = {
    sm: { padding: "8px 14px", fontSize: 13.5, gap: 7, h: 36 },
    md: { padding: "11px 20px", fontSize: 15, gap: 8, h: 44 },
    lg: { padding: "15px 26px", fontSize: 16.5, gap: 9, h: 54 },
  }[size];
  const variants = {
    primary: { background: hover ? "var(--red-600)" : "var(--red-500)", color: "#fff", boxShadow: hover ? "var(--sh-red)" : "0 1px 2px rgba(225,29,42,.18)", border: "1px solid transparent" },
    dark:    { background: hover ? "#000" : "var(--ink)", color: "#fff", border: "1px solid transparent" },
    ghost:   { background: hover ? "var(--line-soft)" : "transparent", color: "var(--ink)", border: "1px solid var(--line)" },
    soft:    { background: hover ? "var(--red-100)" : "var(--red-50)", color: "var(--red-600)", border: "1px solid transparent" },
    green:   { background: hover ? "var(--green-600)" : "var(--green-500)", color: "#fff", border: "1px solid transparent" },
    plain:   { background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
  }[variant];
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: sizes.gap, padding: sizes.padding, fontSize: sizes.fontSize, minHeight: sizes.h,
        fontWeight: 600, borderRadius: "var(--r-pill)", letterSpacing: "-.01em",
        width: full ? "100%" : "auto", transition: "all .18s ease",
        opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto",
        ...variants, ...style,
      }}
    >
      {icon && <Icon name={icon} size={sizes.fontSize + 3} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizes.fontSize + 3} />}
    </button>
  );
}

/* ---------- Card ---------- */
function Card({ children, style, pad = 22, hover, onClick, className = "" }) {
  const [h, setH] = useState(false);
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)", padding: pad,
        boxShadow: h ? "var(--sh-md)" : "var(--sh-sm)",
        transform: h ? "translateY(-2px)" : "none",
        transition: "all .2s ease", cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >{children}</div>
  );
}

/* ---------- Badge / Pill ---------- */
function Badge({ children, tone = "neutral", icon, dot, style }) {
  const tones = {
    neutral: { fg: "var(--ink-soft)", bg: "var(--line-soft)" },
    red:     { fg: "var(--red-600)",  bg: "var(--red-50)" },
    green:   { fg: "var(--green-600)", bg: "var(--green-100)" },
    amber:   { fg: "var(--amber-600)", bg: "var(--amber-100)" },
    ai:      { fg: "#1f5fa6", bg: "#e8f1fb" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: dot ? "5px 11px 5px 9px" : "5px 11px", borderRadius: "var(--r-pill)",
      fontSize: 12.5, fontWeight: 600, letterSpacing: "-.01em",
      color: tones.fg, background: tones.bg, ...style,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: tones.fg }} />}
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

function StatusBadge({ status, map = STATUS, style }) {
  const s = map[status] || STATUS.resting;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 11px 5px 9px", borderRadius: "var(--r-pill)",
      fontSize: 12.5, fontWeight: 600, color: s.fg, background: s.bg,
      border: status === "empty" ? "1px dashed var(--line)" : "1px solid transparent", ...style,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.dot }} />
      {s.label}
    </span>
  );
}

/* ---------- Avatar (initial-based, no real photos) ---------- */
function Avatar({ name, size = 40, group, color }) {
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("") : "?";
  const hue = useMemo(() => {
    if (!name) return 0;
    let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
  }, [name]);
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      display: "grid", placeItems: "center",
      background: color || `oklch(0.92 0.04 ${hue})`,
      color: color ? "#fff" : `oklch(0.4 0.08 ${hue})`,
      fontWeight: 700, fontSize: size * 0.36, letterSpacing: "-.02em",
      border: "1px solid rgba(0,0,0,.04)",
    }}>{name ? initials : <Icon name="person_add" size={size * 0.5} />}</div>
  );
}

/* ---------- Section label ---------- */
function Eyebrow({ children, color = "var(--red-500)", style }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      color, fontFamily: "var(--ff-mono)", ...style,
    }}>{children}</div>
  );
}

/* ---------- Stat ---------- */
function Stat({ value, label, sub, color = "var(--ink)", size = 34 }) {
  return (
    <div>
      <div className="tnum" style={{ fontSize: size, fontWeight: 800, color, letterSpacing: "-.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 7, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ---------- Logo (placeholder wordmark — swap real BW logo later) ---------- */
function Logo({ size = 22, mono }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: size + 8, height: size + 8, borderRadius: 9, background: "var(--red-500)",
        display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(225,29,42,.3)",
      }}>
        <Icon name="water_drop" size={size - 4} fill color="#fff" />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontWeight: 800, fontSize: size * 0.82, letterSpacing: "-.03em", color: mono ? "#fff" : "var(--ink)" }}>
          Thal<span style={{ color: "var(--red-500)" }}>Net</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Divider ---------- */
function Divider({ style }) { return <div style={{ height: 1, background: "var(--line)", ...style }} />; }

/* ---------- Progress ring (generic) ---------- */
function Ring({ value, size = 64, stroke = 7, color = "var(--green-500)", track = "var(--line)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

Object.assign(window, {
  STATUS, HEALTH, Icon, Button, Card, Badge, StatusBadge, Avatar, Eyebrow, Stat, Logo, Divider, Ring,
});
