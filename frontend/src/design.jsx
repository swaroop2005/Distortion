// ThalNet shared design primitives

export function Icon({ name, size = 18, fill = false, color, style }) {
  return (
    <span
      className={"ms" + (fill ? " fill" : "")}
      style={{ fontSize: size, color, lineHeight: 1, ...style }}
    >
      {name}
    </span>
  );
}

export function Card({ children, style, pad = 20, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: pad,
        boxShadow: "var(--sh-sm)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const BTN_VARIANTS = {
  primary: (dis) => ({ background: dis ? "var(--red-100)" : "var(--red-500)", color: dis ? "var(--red-400)" : "#fff", border: "none" }),
  ghost: () => ({ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)" }),
  soft: () => ({ background: "var(--red-50)", color: "var(--red-600)", border: "none" }),
  green: () => ({ background: "var(--green-500)", color: "#fff", border: "none" }),
  danger: () => ({ background: "var(--red-500)", color: "#fff", border: "none" }),
};

export function Btn({ children, variant = "primary", size = "md", icon, onClick, disabled, style, full }) {
  const v = (BTN_VARIANTS[variant] || BTN_VARIANTS.ghost)(disabled);
  const padding = size === "lg" ? "13px 22px" : size === "sm" ? "7px 14px" : "10px 18px";
  const fontSize = size === "lg" ? 15 : size === "sm" ? 13 : 14;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center",
        justifyContent: full ? "center" : undefined,
        gap: 7, fontFamily: "inherit", fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: 10, padding, fontSize,
        transition: "all .18s",
        opacity: disabled ? 0.6 : 1,
        width: full ? "100%" : undefined,
        ...v, ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} fill color="currentColor" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral", dot = false, style }) {
  const TONES = {
    neutral: { color: "#6b6e76", bg: "#f0f0f3" },
    green:   { color: "#1c7a52", bg: "#e2f3ea" },
    amber:   { color: "#b06f12", bg: "#f7eccf" },
    red:     { color: "#9e1420", bg: "#fbe3e4" },
    blue:    { color: "#1f5fa6", bg: "#e8f1fb" },
  };
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
      color: t.color, background: t.bg, ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.color }} />}
      {children}
    </span>
  );
}

export function Eyebrow({ children, color, style }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em",
      textTransform: "uppercase", color: color || "var(--red-500)", ...style,
    }}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 56 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        border: "2.5px solid var(--red-100)",
        borderTopColor: "var(--red-500)",
        animation: "spin .7s linear infinite",
      }} />
    </div>
  );
}

export function ErrBox({ msg }) {
  return (
    <div style={{
      background: "var(--red-50)", border: "1px solid var(--red-100)",
      borderRadius: 12, padding: "16px 20px", color: "var(--red-700)", fontSize: 14,
    }}>
      {msg}
    </div>
  );
}

export function IntegrityBadge({ status }) {
  const norm = (status || "").toLowerCase().replace(/\s/g, "-");
  const MAP = {
    full:     { tone: "green", label: "Full",     icon: "check_circle" },
    "at-risk":{ tone: "amber", label: "At-risk",  icon: "warning" },
    broken:   { tone: "red",   label: "Broken",   icon: "cancel" },
  };
  const cfg = MAP[norm] || MAP.full;
  const COLORS = { green: "#1c7a52", amber: "#b06f12", red: "#9e1420" };
  const BG = { green: "#e2f3ea", amber: "#f7eccf", red: "#fbe3e4" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
      color: COLORS[cfg.tone], background: BG[cfg.tone],
    }}>
      <Icon name={cfg.icon} size={13} fill color={COLORS[cfg.tone]} />
      {cfg.label}
    </span>
  );
}
