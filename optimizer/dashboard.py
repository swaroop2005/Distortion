"""Generate a self-contained HTML command-center dashboard from optimizer results.

Runs the pipeline at several demand scales (so coordinators can explore baseline
vs. surge), aggregates the results to a compact JSON, and renders a single
``dashboard.html`` with the data embedded — no server, no build step, no CORS.
Open it in any browser or drop it on S3/Amplify for Blood Warriors to host.

    python -m optimizer.dashboard
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .config import Settings
from .demand import build_demand
from .gap import compute_group_gaps
from .geo import TELANGANA_CENTROIDS
from .mobilization import build_mobilization_plan
from .redistribution import optimize_redistribution
from .supply import build_supply

# Scenario ladder: label + demand multiplier. Baseline = the raw sample.
SCENARIOS = [
    ("baseline", "Current sample (baseline)", 1.0),
    ("moderate", "Moderate load (10×)", 10.0),
    ("surge", "Peak surge (30×)", 30.0),
]
DEFAULT_SCENARIO = "moderate"  # opens on a scenario that shows the engine working


def _coverage_rows(gaps) -> list[dict]:
    rows = []
    for g in gaps:
        days = None if g.days_of_coverage == float("inf") else round(g.days_of_coverage, 1)
        rows.append({
            "group": g.blood_group,
            "supply": g.supply_units,
            "demand": round(g.horizon_demand, 1),
            "days": days,
            "status": g.status,
            "shortfall": round(g.shortfall_units, 1),
        })
    return rows


def _district_rows(demand: dict, supply: dict, transfers: list[dict], mob: list[dict]) -> list[dict]:
    """Per-district aggregates for the map (supply, demand, incoming, donors)."""
    incoming: dict[str, int] = {}
    for t in transfers:
        incoming[t["to_district"]] = incoming.get(t["to_district"], 0) + t["units"]
    donors: dict[str, int] = {}
    for m in mob:
        donors[m["district"]] = donors.get(m["district"], 0) + 1

    names = {d for (d, _g) in supply["by_district_group"]}
    names |= {d for (d, _g) in demand["by_district_group"]}
    names |= set(incoming) | set(donors)

    rows = []
    for name in names:
        c = TELANGANA_CENTROIDS.get(name)
        if not c:
            continue
        s = sum(u for (d, _g), u in supply["by_district_group"].items() if d == name)
        dem = sum(v["units"] for (d, _g), v in demand["by_district_group"].items() if d == name)
        inc = incoming.get(name, 0)
        don = donors.get(name, 0)
        rows.append({
            "name": name, "lat": c[0], "lng": c[1],
            "supply": int(s), "demand": round(dem, 1),
            "incoming": inc, "donors": don,
            "deficit": round(max(0.0, dem - s), 1),
        })
    return sorted(rows, key=lambda r: -r["deficit"])


def _scenario_data(scale: float) -> dict:
    s = Settings()
    s.demand_scale = scale
    s.use_solver = True  # falls back to greedy automatically if PuLP absent
    demand = build_demand(s)
    supply = build_supply(s)
    gaps = compute_group_gaps(demand, supply)
    transfers, residual = optimize_redistribution(demand, supply, s)
    mob = build_mobilization_plan(residual, s)

    cov = _coverage_rows(gaps)
    finite_days = [r["days"] for r in cov if r["days"] is not None]
    mob_by_group: dict[str, int] = {}
    for m in mob:
        mob_by_group[m["blood_group"]] = mob_by_group.get(m["blood_group"], 0) + 1

    return {
        "scale": scale,
        "banks": supply["banks"],
        "kpis": {
            "critical": sum(1 for r in cov if r["status"] == "CRITICAL"),
            "low": sum(1 for r in cov if r["status"] == "LOW"),
            "first_shortage_days": min(finite_days) if finite_days else None,
            "total_supply": sum(supply["by_group"].values()),
            "total_demand": round(sum(v["units"] for v in demand["by_group"].values()), 0),
            "transfers": len(transfers),
            "units_moved": sum(t["units"] for t in transfers),
            "donors": len(mob),
        },
        "coverage": cov,
        "districts": _district_rows(demand, supply, transfers, mob),
        "top_transfers": sorted(transfers, key=lambda t: -t["units"])[:15],
        "mobilization_by_group": sorted(
            ({"group": g, "count": n} for g, n in mob_by_group.items()),
            key=lambda x: -x["count"],
        ),
    }


def build_payload() -> dict:
    s0 = Settings()
    demand0 = build_demand(s0)
    return {
        "region": s0.region,
        "as_of": demand0["as_of"],
        "horizon_days": demand0["horizon_days"],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "default_scenario": DEFAULT_SCENARIO,
        "scenarios": {key: {"label": label, **_scenario_data(scale)}
                      for key, label, scale in SCENARIOS},
        "scenario_order": [key for key, _l, _s in SCENARIOS],
    }


def render_html(payload: dict) -> str:
    return _TEMPLATE.replace("__DATA__", json.dumps(payload, ensure_ascii=False))


def main(argv: list[str] | None = None) -> None:
    s = Settings()
    s.ensure_dirs()
    payload = build_payload()
    out = s.out_dir / "dashboard.html"
    out.write_text(render_html(payload), encoding="utf-8")
    print(f"dashboard written -> {out}")
    print(f"  scenarios: {', '.join(payload['scenario_order'])}  ·  open in a browser")


# --------------------------------------------------------------------------- #
# HTML template. Data is injected at __DATA__. CSS/JS use no str.format braces.
# --------------------------------------------------------------------------- #
_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Blood Warriors · Supply Command Center</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{
    --bw-red:#e63148; --bw-red-d:#c11733; --navy:#0a2540; --navy-2:#13355c;
    --bg:#eef2f7; --card:#ffffff; --ink:#16202c; --muted:#6b7a8d;
    --crit:#e5484d; --low:#f5a524; --ok:#17b26a; --line:#e3e9f0;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       background:var(--bg);color:var(--ink);font-size:14px}
  header{background:linear-gradient(100deg,var(--navy) 0%,var(--navy-2) 100%);color:#fff;
         padding:18px 26px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 14px rgba(10,37,64,.18)}
  .drop{width:34px;height:34px;flex:0 0 auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
  header h1{font-size:19px;margin:0;font-weight:700;letter-spacing:.2px}
  header .sub{font-size:12px;color:#aebfd4;margin-top:2px}
  header .spacer{flex:1}
  .scenario{display:flex;align-items:center;gap:8px}
  .scenario label{font-size:12px;color:#aebfd4}
  select{background:#0e2a4a;color:#fff;border:1px solid #2b517d;border-radius:8px;padding:8px 12px;
         font-size:13px;font-weight:600;cursor:pointer}
  main{padding:20px 26px 40px;max-width:1380px;margin:0 auto}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:18px}
  .kpi{background:var(--card);border-radius:14px;padding:15px 17px;border:1px solid var(--line);
       box-shadow:0 1px 3px rgba(16,32,44,.05)}
  .kpi .v{font-size:26px;font-weight:750;line-height:1.1}
  .kpi .l{font-size:11.5px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.4px}
  .kpi .t{font-size:11px;color:var(--muted);margin-top:3px}
  .kpi.alert .v{color:var(--crit)} .kpi.warn .v{color:var(--low)} .kpi.good .v{color:var(--ok)}
  .grid{display:grid;grid-template-columns:1.05fr 1fr;gap:16px}
  .card{background:var(--card);border-radius:14px;border:1px solid var(--line);
        box-shadow:0 1px 3px rgba(16,32,44,.05);overflow:hidden}
  .card h2{font-size:13px;margin:0;padding:14px 18px;border-bottom:1px solid var(--line);
           text-transform:uppercase;letter-spacing:.5px;color:var(--navy);font-weight:700;
           display:flex;align-items:center;gap:8px}
  .card .body{padding:14px 18px}
  #map{height:420px;width:100%}
  .chartwrap{position:relative;height:300px;padding:8px 4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:600}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;color:#fff}
  .pill.CRITICAL{background:var(--crit)} .pill.LOW{background:var(--low)} .pill.OK{background:var(--ok)}
  .grp{font-weight:700;color:var(--navy)}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .legend{font-size:11px;color:var(--muted);padding:8px 18px;border-top:1px solid var(--line);
          display:flex;gap:16px;flex-wrap:wrap}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
  footer{color:var(--muted);font-size:11.5px;text-align:center;padding:22px;max-width:1380px;margin:0 auto}
  .note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;
        padding:9px 13px;font-size:12px;margin-bottom:16px}
  @media(max-width:1000px){.kpis{grid-template-columns:repeat(2,1fr)}.grid,.row2{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <svg class="drop" viewBox="0 0 24 24" fill="#ff5269"><path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>
  <div>
    <h1>Blood Supply Command Center</h1>
    <div class="sub" id="subhead">Blood Warriors · Telangana</div>
  </div>
  <div class="spacer"></div>
  <div class="scenario">
    <label for="scn">Demand scenario</label>
    <select id="scn"></select>
  </div>
</header>
<main>
  <div class="note" id="note"></div>
  <div class="kpis" id="kpis"></div>
  <div class="grid">
    <div class="card">
      <h2>🩸 Coverage by blood group — days of supply</h2>
      <div class="chartwrap"><canvas id="covChart"></canvas></div>
    </div>
    <div class="card">
      <h2>🗺️ District supply &amp; demand map</h2>
      <div id="map"></div>
      <div class="legend">
        <span><span class="dot" style="background:#e5484d"></span>shortfall</span>
        <span><span class="dot" style="background:#f5a524"></span>received transfer</span>
        <span><span class="dot" style="background:#17b26a"></span>covered</span>
        <span>circle size ∝ demand</span>
      </div>
    </div>
  </div>
  <div class="row2">
    <div class="card">
      <h2>🚚 Recommended redistribution (top transfers)</h2>
      <div class="body" style="max-height:330px;overflow:auto"><table id="transfers"></table></div>
    </div>
    <div class="card">
      <h2>📣 Donor mobilization plan <span style="font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0">→ ThalNet outreach</span></h2>
      <div class="body"><div class="chartwrap" style="height:230px"><canvas id="mobChart"></canvas></div>
        <div id="mobtotal" style="text-align:center;color:var(--muted);font-size:12px;margin-top:6px"></div></div>
    </div>
  </div>
</main>
<footer id="foot"></footer>

<script>
const DATA = __DATA__;
const STATUS_COLOR = {CRITICAL:'#e5484d', LOW:'#f5a524', OK:'#17b26a'};
let covChart, mobChart, map, markerLayer, flowLayer;

function fmt(n){ if(n===null||n===undefined) return '—';
  return (typeof n==='number') ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n; }

function initMap(){
  map = L.map('map',{scrollWheelZoom:false}).setView([17.9,79.2],7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {attribution:'© OpenStreetMap © CARTO', maxZoom:12}).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  flowLayer = L.layerGroup().addTo(map);
}

function districtColor(d){
  if(d.demand - d.supply - d.incoming > 0.5 || d.donors>0) return '#e5484d';
  if(d.incoming>0) return '#f5a524';
  return '#17b26a';
}

function renderMap(s){
  markerLayer.clearLayers(); flowLayer.clearLayers();
  const byName = {}; s.districts.forEach(d=>byName[d.name]=d);
  // transfer flow lines
  s.top_transfers.forEach(t=>{
    const a=byName[t.from_district], b=byName[t.to_district];
    if(a&&b){ L.polyline([[a.lat,a.lng],[b.lat,b.lng]],
      {color:'#13355c',weight:Math.min(1+t.units/40,6),opacity:.35}).addTo(flowLayer); }
  });
  s.districts.forEach(d=>{
    const r = 6 + Math.sqrt(d.demand)*1.3;
    L.circleMarker([d.lat,d.lng],{radius:Math.min(r,30),color:'#fff',weight:1.2,
      fillColor:districtColor(d),fillOpacity:.82})
     .bindPopup('<b>'+d.name+'</b><br>Supply: '+fmt(d.supply)+' u<br>Demand: '+fmt(d.demand)+
                ' u<br>Incoming transfer: '+fmt(d.incoming)+' u<br>Donors to mobilize: '+fmt(d.donors))
     .addTo(markerLayer);
  });
}

function renderKpis(s){
  const k=s.kpis;
  const cards=[
    {v:k.critical, l:'Critical groups', t:'< 3 days of supply', cls:k.critical?'alert':'good'},
    {v:(k.first_shortage_days===null?'—':k.first_shortage_days+'d'), l:'First shortage in',
       t:'lowest coverage', cls:(k.first_shortage_days!==null&&k.first_shortage_days<3)?'alert':(k.first_shortage_days!==null&&k.first_shortage_days<7?'warn':'good')},
    {v:fmt(k.units_moved), l:'Units to redistribute', t:k.transfers+' transfers', cls:''},
    {v:fmt(k.donors), l:'Donors to mobilize', t:'→ ThalNet outreach', cls:k.donors?'warn':'good'},
    {v:fmt(k.banks), l:'Banks supplying', t:fmt(k.total_supply)+' units in stock', cls:''},
  ];
  document.getElementById('kpis').innerHTML = cards.map(c=>
    '<div class="kpi '+c.cls+'"><div class="v">'+c.v+'</div><div class="l">'+c.l+'</div><div class="t">'+c.t+'</div></div>').join('');
}

function renderCoverage(s){
  const rows=s.coverage;
  const CAP=60; // cap inf/huge days for readability
  const labels=rows.map(r=>r.group);
  const vals=rows.map(r=>r.days===null?CAP:Math.min(r.days,CAP));
  const cols=rows.map(r=>STATUS_COLOR[r.status]);
  if(covChart) covChart.destroy();
  covChart=new Chart(document.getElementById('covChart'),{
    type:'bar',
    data:{labels,datasets:[{data:vals,backgroundColor:cols,borderRadius:5,barThickness:20}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:(c)=>{const r=rows[c.dataIndex];
          return [' '+(r.days===null?'≥60':r.days)+' days of supply ('+r.status+')',
                  ' supply '+fmt(r.supply)+' u · demand '+fmt(r.demand)+' u'];}}}},
      scales:{x:{title:{display:true,text:'days of supply (capped at 60)'},grid:{color:'#eef2f7'}},
              y:{grid:{display:false},ticks:{font:{weight:'700'}}}}}
  });
}

function renderTransfers(s){
  const t=s.top_transfers;
  let h='<thead><tr><th>From</th><th>To</th><th>Grp</th><th class="num">Units</th><th class="num">km</th></tr></thead><tbody>';
  if(!t.length) h+='<tr><td colspan="5" style="color:var(--muted)">No transfers needed — supply is balanced.</td></tr>';
  t.forEach(x=>{h+='<tr><td>'+x.from_district+'</td><td>'+x.to_district+'</td><td class="grp">'+x.blood_group+
    '</td><td class="num">'+fmt(x.units)+'</td><td class="num">'+x.distance_km+'</td></tr>';});
  document.getElementById('transfers').innerHTML=h+'</tbody>';
}

function renderMob(s){
  const m=s.mobilization_by_group;
  if(mobChart) mobChart.destroy();
  mobChart=new Chart(document.getElementById('mobChart'),{
    type:'bar',
    data:{labels:m.map(x=>x.group),datasets:[{data:m.map(x=>x.count),
      backgroundColor:'#e63148',borderRadius:5,barThickness:22}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+fmt(c.raw)+' donors'}}},
      scales:{y:{grid:{color:'#eef2f7'},title:{display:true,text:'donors to mobilize'}},x:{grid:{display:false},ticks:{font:{weight:'700'}}}}}
  });
  const total=m.reduce((a,b)=>a+b.count,0);
  document.getElementById('mobtotal').textContent = total
    ? total.toLocaleString()+' eligible donors selected (nearest-first) to hand to ThalNet'
    : 'No mobilization needed at this demand level.';
}

function render(key){
  const s=DATA.scenarios[key];
  document.getElementById('note').textContent =
    'Scenario: '+s.label+'  ·  '+(s.scale===1
      ? 'Raw sample demand — statewide supply is healthy; this is the honest baseline.'
      : 'Demand projected '+s.scale+'× toward the real ~100k-patient population to stress-test the network.');
  renderKpis(s); renderCoverage(s); renderMap(s); renderTransfers(s); renderMob(s);
}

function boot(){
  document.getElementById('subhead').textContent =
    'Blood Warriors · '+DATA.region+'  ·  as-of '+DATA.as_of+'  ·  '+DATA.horizon_days+'-day horizon';
  document.getElementById('foot').textContent =
    'Generated '+DATA.generated_at+' · supply: live e-RaktKosh scrape · demand: patient transfusion schedules · red-cell components · prototype for Blood Warriors';
  const sel=document.getElementById('scn');
  DATA.scenario_order.forEach(k=>{const o=document.createElement('option');
    o.value=k;o.textContent=DATA.scenarios[k].label;sel.appendChild(o);});
  sel.value=DATA.default_scenario;
  sel.addEventListener('change',e=>render(e.target.value));
  initMap();
  render(DATA.default_scenario);
}
boot();
</script>
</body>
</html>"""


if __name__ == "__main__":
    main()
