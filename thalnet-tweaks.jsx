/* ThalNet Tweaks Panel */

const { useState } = React;
const { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSelect } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryRed": "#e63148",
  "secondaryGreen": "#17b26a",
  "accentAmber": "#f5a524",
  "bgColor": "#eef2f7",
  "textColor": "#16202c",
  "mutedColor": "#6b7a8d",
  "scope": "telangana",
  "scenario": "moderate",
  "darkMode": false
}/*EDITMODE-END*/;

function ThalNetTweaks({ tweaks, setTweak }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Tweaks toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 999,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: tweaks.primaryRed,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          boxShadow: "0 4px 12px rgba(0,0,0,.15)",
          transition: "all .2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        ⚙️
      </button>

      {/* Tweaks panel — manual render */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            right: 20,
            zIndex: 998,
            width: 280,
            maxHeight: 500,
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${tweaks.borderColor || "#e3e9f0"}`,
            padding: 16,
            boxShadow: "0 10px 40px rgba(0,0,0,.1)",
            overflowY: "auto",
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: tweaks.primaryRed }}>Tweaks</div>

          {/* Brand Colors */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7a8d", marginBottom: 8, letterSpacing: ".05em" }}>
              Brand Colors
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {["#e63148", "#c41e3a", "#b32a2a", "#d93f3f"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTweak("primaryRed", c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: c,
                    border: tweaks.primaryRed === c ? `3px solid #000` : "1px solid #e3e9f0",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7a8d", marginBottom: 8, letterSpacing: ".05em" }}>
              Secondary
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {["#17b26a", "#0f9d4f", "#1ba858", "#20c567"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTweak("secondaryGreen", c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: c,
                    border: tweaks.secondaryGreen === c ? `3px solid #000` : "1px solid #e3e9f0",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7a8d", marginBottom: 8, letterSpacing: ".05em" }}>
              Accent
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["#f5a524", "#f59e0b", "#fbbc04", "#ffb800"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTweak("accentAmber", c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: c,
                    border: tweaks.accentAmber === c ? `3px solid #000` : "1px solid #e3e9f0",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Command Center */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7a8d", marginBottom: 8, letterSpacing: ".05em" }}>
              Command Center
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["india", "telangana"].map((s) => (
                <button
                  key={s}
                  onClick={() => setTweak("scope", s)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: tweaks.scope === s ? `2px solid ${tweaks.primaryRed}` : "1px solid #e3e9f0",
                    background: tweaks.scope === s ? tweaks.primaryRed : "#fff",
                    color: tweaks.scope === s ? "#fff" : "#16202c",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {tweaks.scope === "telangana" && (
              <div style={{ display: "flex", gap: 6 }}>
                {["baseline", "moderate", "surge"].map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setTweak("scenario", sc)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: tweaks.scenario === sc ? `2px solid ${tweaks.primaryRed}` : "1px solid #e3e9f0",
                      background: tweaks.scenario === sc ? tweaks.primaryRed : "#fff",
                      color: tweaks.scenario === sc ? "#fff" : "#16202c",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setOpen(false)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 6,
              background: "#f3f4f6",
              border: "1px solid #e3e9f0",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              color: "#16202c",
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ThalNetTweaks, TWEAK_DEFAULTS });
