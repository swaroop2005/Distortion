/* ThalNet — live data overlay.
   Fetches the real backend and overwrites the genuinely-live, populated fields
   on window.TN (built by data.js). Everything it can't map stays as the curated
   mock, so the UI never goes blank. Every fetch is guarded; failure = keep mock.

   Set window.API_BASE before this loads (defaults to http://localhost:8000). */
(function () {
  const BASE = (typeof window !== "undefined" && window.API_BASE) || "http://localhost:8000";

  async function getJSON(path) {
    const r = await fetch(BASE + path);
    if (!r.ok) throw new Error(path + " -> " + r.status);
    return r.json();
  }

  // scarcity tiering for regional stock badges
  function statusForUnits(u) {
    if (u < 50) return "critical";
    if (u < 100) return "low";
    if (u < 200) return "watch";
    return "ok";
  }

  function firstId(payload, key) {
    const arr = (payload && (payload[key] || payload.items || payload.results)) || [];
    const row = Array.isArray(arr) ? arr[0] : null;
    return (row && (row.user_id || row.id)) || null;
  }

  // Load live data and overwrite the mappable fields, then re-render.
  window.loadLiveTN = async function loadLiveTN(onUpdate) {
    const TN = window.TN;
    if (!TN) return;
    let changed = false;

    // 1) Admin dashboard -> real donor pool size (4,446 donors is real & impressive)
    try {
      const d = await getJSON("/admin/dashboard");
      if (typeof d.total_donors === "number") { TN.adminStats.donorPool = d.total_donors; changed = true; }
      if (typeof d.eligible_donors === "number") { TN.adminStats.donorsActive = d.eligible_donors; }
      if (typeof d.total_patients === "number") { TN.adminStats.activeRequests = d.upcoming_transfusions ?? TN.adminStats.activeRequests; }
      // national supply KPIs are already real in the mock (3,863 banks / 44,675 rows);
      // refresh bank count from live just in case it changed.
      if (d.supply && typeof d.supply.total_banks_indexed === "number") {
        TN.supply.nationalBanks = d.supply.total_banks_indexed;
      }
    } catch (e) { console.warn("[tn-live] dashboard skipped:", e.message); }

    // 2) Telangana regional supply -> real per-blood-group units (authentic e-RaktKosh)
    try {
      const s = await getJSON("/supply/regional?state=Telangana");
      if (s && s.by_group && typeof s.by_group === "object") {
        TN.supply.regional = Object.entries(s.by_group)
          .map(([group, units]) => ({ group, units, status: statusForUnits(units) }))
          .sort((a, b) => a.units - b.units);
        changed = true;
      }
    } catch (e) { console.warn("[tn-live] regional supply skipped:", e.message); }

    // 3) Real patient/donor ids so the chatbot can answer personal questions live.
    try {
      const [pts, dns] = await Promise.all([
        getJSON("/admin/patients?limit=1").catch(() => null),
        getJSON("/admin/donors?limit=1").catch(() => null),
      ]);
      window.TN_USER = {
        patientId: firstId(pts, "patients"),
        donorId: firstId(dns, "donors"),
      };
    } catch (e) { console.warn("[tn-live] ids skipped:", e.message); }

    if (changed && typeof onUpdate === "function") onUpdate();
  };
})();
