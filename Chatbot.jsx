/* ThalNet — floating chatbot. Live AI (window.claude), multilingual EN/HI/TE,
   context-aware (knows the role + page). Tone: kind, calm, honest. */

const LANGS = {
  en: { label: "EN", name: "English", placeholder: "Ask anything…", greet: "Hello. I'm here to help — with your bridge, donations, or anything about thalassemia. What's on your mind?", thinking: "Typing…", title: "ThalNet Assistant" },
  hi: { label: "हि", name: "हिंदी", placeholder: "कुछ भी पूछें…", greet: "नमस्ते। मैं आपकी मदद के लिए यहाँ हूँ — आपके ब्रिज, रक्तदान, या थैलेसीमिया के बारे में। बताइए?", thinking: "लिख रहे हैं…", title: "थैलनेट सहायक" },
  te: { label: "తె", name: "తెలుగు", placeholder: "ఏదైనా అడగండి…", greet: "నమస్కారం. మీ బ్రిడ్జ్, రక్తదానం లేదా థలసీమియా గురించి సహాయం చేయడానికి ఇక్కడ ఉన్నాను. ఏం తెలుసుకోవాలి?", thinking: "టైప్ చేస్తున్నారు…", title: "థల్‌నెట్ సహాయకుడు" },
};

const QUICK = {
  patient: { en: ["When is my next transfusion?", "Is my blood bridge okay?", "I need blood urgently"], hi: ["मेरा अगला ट्रांसफ्यूजन कब है?", "क्या मेरा ब्लड ब्रिज ठीक है?", "मुझे तुरंत खून चाहिए"], te: ["నా తదుపరి ట్రాన్స్‌ఫ్యూజన్ ఎప్పుడు?", "నా బ్లడ్ బ్రిడ్జ్ బాగుందా?", "నాకు అత్యవసరంగా రక్తం కావాలి"] },
  donor:   { en: ["When can I donate again?", "Who did my blood help?", "Am I eligible today?"], hi: ["मैं फिर कब रक्तदान कर सकता हूँ?", "मेरे खून से किसे मदद मिली?", "क्या मैं आज पात्र हूँ?"], te: ["నేను మళ్లీ ఎప్పుడు దానం చేయవచ్చు?", "నా రక్తం ఎవరికి సహాయపడింది?", "నేను ఈరోజు అర్హుడినా?"] },
  admin:   { en: ["Which bridges are at risk?", "Summarize today's outreach", "Any O- shortages?"], hi: ["कौन से ब्रिज जोखिम में हैं?", "आज की आउटरीच का सारांश दें", "O- की कमी है क्या?"], te: ["ఏ బ్రిడ్జ్‌లు ప్రమాదంలో ఉన్నాయి?", "నేటి ఔట్‌రీచ్ సారాంశం", "O- కొరత ఉందా?"] },
  visitor: { en: ["What is a Blood Bridge?", "What is thalassemia?", "How do I become a donor?"], hi: ["ब्लड ब्रिज क्या है?", "थैलेसीमिया क्या है?", "मैं डोनर कैसे बनूँ?"], te: ["బ్లడ్ బ్రిడ్జ్ అంటే ఏమిటి?", "థలసీమియా అంటే ఏమిటి?", "నేను దాతగా ఎలా మారాలి?"] },
};

function Chatbot({ role = "visitor", pageContext = "" }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const L = LANGS[lang];

  useEffect(() => { setMsgs([{ role: "bot", text: L.greet }]); }, [lang]);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy, open]);

  const systemFor = () => `You are the ThalNet Assistant, a warm, calm, honest healthcare companion for Blood Warriors — an NGO coordinating voluntary blood donors for thalassemia patients in India. 
Tone: like a kind nurse or trusted family friend. Gentle, plain, never salesy. No motivational hype, no exclamation marks, no emojis, no gamification (no streaks/points/leaderboards). Be brief — 2-4 short sentences.
Honesty: thalassemia is lifelong; major patients need ~500-700 transfusions over a lifetime, roughly every 20-25 days. Never imply a cure or "beating it". 
A "Blood Bridge" is a group of 8-10 regular donors maintained around one patient so transfusions are reliable; ThalNet's AI builds, monitors and self-heals these bridges and contacts donors in EN/HI/TE.
Current user role: ${role}. Page context: ${pageContext || "general"}.
IMPORTANT: reply ONLY in ${L.name}. If asked anything medical-emergency, advise contacting their care team or the listed helpline immediately.`;

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const next = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setBusy(true);
    try {
      let reply;
      if (window.claude && window.claude.complete) {
        const history = next.slice(-6).map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n");
        reply = await window.claude.complete({
          messages: [{ role: "user", content: `${systemFor()}\n\nConversation so far:\n${history}\n\nReply as the Assistant in ${L.name}:` }],
        });
      } else {
        reply = L.greet;
      }
      setMsgs(m => [...m, { role: "bot", text: (reply || "").trim() || "…" }]);
    } catch (e) {
      setMsgs(m => [...m, { role: "bot", text: { en: "I'm having trouble responding right now. Please try again, or call +91 62814 77836 if it's urgent.", hi: "अभी जवाब देने में दिक्कत हो रही है। कृपया दोबारा कोशिश करें, या ज़रूरी हो तो +91 62814 77836 पर कॉल करें।", te: "ప్రస్తుతం స్పందించడంలో ఇబ్బంది ఉంది. దయచేసి మళ్లీ ప్రయత్నించండి, అత్యవసరమైతే +91 62814 77836 కి కాల్ చేయండి." }[lang] }]);
    } finally { setBusy(false); }
  }

  const quick = (QUICK[role] || QUICK.visitor)[lang];

  return (
    <>
      {/* launcher */}
      <button onClick={() => setOpen(o => !o)} aria-label="Open assistant" style={{
        position: "fixed", right: 22, bottom: 22, zIndex: 1000,
        width: 60, height: 60, borderRadius: 99, border: "none",
        background: open ? "var(--ink)" : "var(--red-500)", color: "#fff",
        boxShadow: "var(--sh-lg)", display: "grid", placeItems: "center",
        transition: "all .25s ease", transform: open ? "scale(.92)" : "scale(1)",
      }}>
        <Icon name={open ? "close" : "forum"} size={26} fill />
      </button>

      {/* panel */}
      {open && (
        <div className="fade-up" style={{
          position: "fixed", right: 22, bottom: 94, zIndex: 1000,
          width: "min(384px, calc(100vw - 32px))", height: "min(580px, calc(100vh - 130px))",
          background: "#fff", borderRadius: 20, boxShadow: "var(--sh-lg)",
          border: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* header */}
          <div style={{ padding: "14px 16px", background: "var(--red-500)", color: "#fff", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center" }}>
              <Icon name="health_and_safety" size={22} fill />
            </div>
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{L.title}</div>
              <div style={{ fontSize: 11.5, opacity: .85, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "#9ef0c0" }} /> Online · EN · हिंदी · తెలుగు
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,.14)", borderRadius: 99, padding: 3 }}>
              {Object.keys(LANGS).map(k => (
                <button key={k} onClick={() => setLang(k)} style={{
                  border: "none", borderRadius: 99, padding: "5px 9px", fontSize: 12, fontWeight: 700,
                  background: lang === k ? "#fff" : "transparent", color: lang === k ? "var(--red-600)" : "#fff",
                  transition: "all .15s",
                }}>{LANGS[k].label}</button>
              ))}
            </div>
          </div>

          {/* messages */}
          <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: 16, background: "var(--bg)", display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "10px 13px", borderRadius: 15, fontSize: 14.5, lineHeight: 1.45,
                  background: m.role === "user" ? "var(--red-500)" : "#fff",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  border: m.role === "user" ? "none" : "1px solid var(--line)",
                  borderBottomRightRadius: m.role === "user" ? 5 : 15,
                  borderBottomLeftRadius: m.role === "user" ? 15 : 5,
                  boxShadow: "var(--sh-sm)", whiteSpace: "pre-wrap",
                }}>{m.text}</div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 15, width: "fit-content" }}>
                {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: "var(--faint)", animation: `blink 1.2s infinite ${i*.2}s` }} />)}
              </div>
            )}
          </div>

          {/* quick replies */}
          {msgs.length <= 1 && !busy && (
            <div style={{ padding: "10px 12px 0", display: "flex", flexWrap: "wrap", gap: 7 }}>
              {quick.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{
                  border: "1px solid var(--line)", background: "#fff", borderRadius: 99,
                  padding: "7px 12px", fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500,
                }}>{q}</button>
              ))}
            </div>
          )}

          {/* input */}
          <div style={{ padding: 12, borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder={L.placeholder}
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 99, padding: "11px 16px", fontSize: 14.5, outline: "none", fontFamily: "inherit", background: "var(--bg)" }} />
            <button onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send" style={{
              width: 44, height: 44, borderRadius: 99, border: "none", flexShrink: 0,
              background: input.trim() ? "var(--red-500)" : "var(--line)", color: "#fff",
              display: "grid", placeItems: "center", transition: "background .15s",
            }}>
              <Icon name="arrow_upward" size={22} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { Chatbot });
