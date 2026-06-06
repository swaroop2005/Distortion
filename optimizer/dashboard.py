"""Generate a self-contained HTML command-center dashboard.

Two scopes, switchable in the UI:
  * **India**     — national supply + safety-stock rebalance on a state-level map
                    (all scraped states). Supply/rebalance only (demand data is
                    Telangana-only, so national shortage analysis would be fake).
  * **Telangana** — the demand-driven command center, with baseline/10×/30×
                    demand scenarios.

Runs the pipeline, aggregates to a compact JSON, and embeds it in one
``dashboard.html`` (no server, no build step, no CORS).

    python -m optimizer.dashboard
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone

from .banks import load_banks
from .config import CANONICAL_GROUPS, Settings
from .demand import build_demand
from .gap import compute_group_gaps
from .geo import STATE_CENTROIDS, TELANGANA_CENTROIDS
from .mobilization import build_mobilization_plan
from .redistribution import redistribute_demand, redistribute_rebalance
from .supply import build_supply

SCENARIOS = [
    ("baseline", "Current sample (baseline)", 1.0),
    ("moderate", "Moderate load (10×)", 10.0),
    ("surge", "Peak surge (30×)", 30.0),
]
DEFAULT_SCENARIO = "moderate"


# --------------------------------------------------------------------------- #
# Telangana (demand-driven) scope
# --------------------------------------------------------------------------- #
def _coverage_rows(gaps) -> list[dict]:
    rows = []
    for g in gaps:
        days = None if g.days_of_coverage == float("inf") else round(g.days_of_coverage, 1)
        rows.append({"group": g.blood_group, "supply": g.supply_units,
                     "demand": round(g.horizon_demand, 1), "days": days,
                     "status": g.status, "shortfall": round(g.shortfall_units, 1)})
    return rows


def _district_rows(demand, supply, transfers, mob) -> list[dict]:
    incoming: dict[str, int] = defaultdict(int)
    for t in transfers:
        incoming[t["to_district"]] += t["units"]
    donors: dict[str, int] = defaultdict(int)
    for m in mob:
        donors[m["district"]] += 1
    names = {d for (d, _g) in supply["by_district_group"]}
    names |= {d for (d, _g) in demand["by_district_group"]} | set(incoming) | set(donors)
    rows = []
    for name in names:
        c = TELANGANA_CENTROIDS.get(name)
        if not c:
            continue
        s = sum(u for (d, _g), u in supply["by_district_group"].items() if d == name)
        dem = sum(v["units"] for (d, _g), v in demand["by_district_group"].items() if d == name)
        rows.append({"name": name, "lat": c[0], "lng": c[1], "supply": int(s),
                     "demand": round(dem, 1), "incoming": incoming.get(name, 0),
                     "donors": donors.get(name, 0), "deficit": round(max(0.0, dem - s), 1)})
    return sorted(rows, key=lambda r: -r["deficit"])


def _scenario_data(scale: float) -> dict:
    s = Settings()
    s.demand_scale = scale
    s.mode = "demand"
    s.use_solver = True
    demand = build_demand(s)
    supply = build_supply(s)
    gaps = compute_group_gaps(demand, supply)
    region_banks = load_banks(s, national=False)
    transfers, residual = redistribute_demand(region_banks, demand, s)
    mob = build_mobilization_plan(residual, s)

    cov = _coverage_rows(gaps)
    finite = [r["days"] for r in cov if r["days"] is not None]
    mob_by_group: dict[str, int] = defaultdict(int)
    for m in mob:
        mob_by_group[m["blood_group"]] += 1
    return {
        "scale": scale, "banks": supply["banks"],
        "kpis": {
            "critical": sum(1 for r in cov if r["status"] == "CRITICAL"),
            "low": sum(1 for r in cov if r["status"] == "LOW"),
            "first_shortage_days": min(finite) if finite else None,
            "total_supply": sum(supply["by_group"].values()),
            "transfers": len(transfers), "units_moved": sum(t["units"] for t in transfers),
            "donors": len(mob),
        },
        "coverage": cov,
        "districts": _district_rows(demand, supply, transfers, mob),
        "top_transfers": [
            {"from_bank": t["from_bank"], "from_district": t["from_district"],
             "from_type": t["from_type"], "from_capacity": t["from_capacity"],
             "to_bank": t["to_bank"], "to_district": t["to_district"],
             "blood_group": t["blood_group"], "units": t["units"], "distance_km": t["distance_km"]}
            for t in sorted(transfers, key=lambda t: -t["units"])[:15]],
        "mobilization_by_group": sorted(
            ({"group": g, "count": n} for g, n in mob_by_group.items()), key=lambda x: -x["count"]),
    }


# --------------------------------------------------------------------------- #
# India (national supply + rebalance) scope
# --------------------------------------------------------------------------- #
def build_india() -> dict:
    s = Settings()
    banks = load_banks(s, national=True)

    states: dict[str, dict] = {}
    by_group: dict[str, int] = defaultdict(int)
    for b in banks:
        st = b["state"] or "Unknown"
        agg = states.setdefault(st, {"units": 0, "banks": 0, "by_group": defaultdict(int)})
        agg["banks"] += 1
        for g, u in b["stock"].items():
            agg["units"] += u
            agg["by_group"][g] += u
            by_group[g] += u

    transfers, under = redistribute_rebalance(banks, s)
    under_by_state: dict[str, int] = defaultdict(int)
    for u in under:
        under_by_state[u["state"] or "Unknown"] += 1
    flows: dict[tuple, int] = defaultdict(int)
    for t in transfers:
        if t["from_state"] != t["to_state"]:
            flows[(t["from_state"], t["to_state"])] += t["units"]

    state_rows = []
    for st, agg in states.items():
        c = STATE_CENTROIDS.get(st)
        if not c:
            continue
        top_groups = sorted(agg["by_group"].items(), key=lambda kv: -kv[1])[:4]
        state_rows.append({"name": st, "lat": c[0], "lng": c[1], "units": agg["units"],
                           "banks": agg["banks"], "below_safety": under_by_state.get(st, 0),
                           "top_groups": [{"g": g, "u": u} for g, u in top_groups]})
    state_rows.sort(key=lambda r: -r["units"])

    flow_rows = [{"from": f, "to": t, "units": u}
                 for (f, t), u in sorted(flows.items(), key=lambda kv: -kv[1])[:40]]
    order = {g: i for i, g in enumerate(CANONICAL_GROUPS)}
    return {
        "safety_stock": s.safety_stock,
        "kpis": {
            "states": len(state_rows), "banks": len(banks),
            "total_units": sum(by_group.values()), "transfers": len(transfers),
            "units_moved": sum(t["units"] for t in transfers), "banks_below_safety": len(under),
        },
        "states": state_rows,
        "by_group": sorted(({"group": g, "units": u} for g, u in by_group.items()),
                           key=lambda x: order.get(x["group"], 99)),
        "state_flows": flow_rows,
        "top_states": [{"name": r["name"], "units": r["units"]} for r in state_rows[:10]],
        "top_transfers": [
            {"from_bank": t["from_bank"], "from_state": t["from_state"],
             "to_bank": t["to_bank"], "to_state": t["to_state"],
             "blood_group": t["blood_group"], "units": t["units"], "distance_km": t["distance_km"]}
            for t in sorted(transfers, key=lambda t: -t["units"])[:15]],
    }


def build_payload() -> dict:
    s0 = Settings()
    demand0 = build_demand(s0)
    return {
        "region": s0.region, "as_of": demand0["as_of"], "horizon_days": demand0["horizon_days"],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "telangana": {
            "default_scenario": DEFAULT_SCENARIO,
            "scenario_order": [k for k, _l, _s in SCENARIOS],
            "scenario_labels": {k: l for k, l, _s in SCENARIOS},
            "scenarios": {k: _scenario_data(scale) for k, _l, scale in SCENARIOS},
        },
        "india": build_india(),
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
    print("  scopes: India (national supply + rebalance) · Telangana (demand)  ·  open in a browser")


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
  :root{--bw-red:#e63148;--navy:#0a2540;--navy-2:#13355c;--bg:#eef2f7;--card:#fff;
    --ink:#16202c;--muted:#6b7a8d;--crit:#e5484d;--low:#f5a524;--ok:#17b26a;--line:#e3e9f0}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       background:var(--bg);color:var(--ink);font-size:14px}
  header{background:linear-gradient(100deg,var(--navy),var(--navy-2));color:#fff;padding:16px 26px;
         display:flex;align-items:center;gap:16px;box-shadow:0 2px 14px rgba(10,37,64,.18);flex-wrap:wrap}
  .drop{width:32px;height:32px;flex:0 0 auto}
  header h1{font-size:18px;margin:0;font-weight:700}
  header .sub{font-size:12px;color:#aebfd4;margin-top:2px}
  header .spacer{flex:1}
  .toggle{display:flex;background:#0e2a4a;border-radius:9px;padding:3px;border:1px solid #2b517d}
  .toggle button{background:transparent;color:#aebfd4;border:0;padding:7px 15px;border-radius:7px;
    font-size:13px;font-weight:700;cursor:pointer}
  .toggle button.active{background:var(--bw-red);color:#fff}
  .scenario{display:flex;align-items:center;gap:8px}
  .scenario label{font-size:12px;color:#aebfd4}
  select{background:#0e2a4a;color:#fff;border:1px solid #2b517d;border-radius:8px;padding:8px 12px;
         font-size:13px;font-weight:600;cursor:pointer}
  main{padding:18px 26px 40px;max-width:1380px;margin:0 auto}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:16px}
  .kpi{background:var(--card);border-radius:14px;padding:15px 17px;border:1px solid var(--line);
       box-shadow:0 1px 3px rgba(16,32,44,.05)}
  .kpi .v{font-size:25px;font-weight:750;line-height:1.1}
  .kpi .l{font-size:11.5px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.4px}
  .kpi .t{font-size:11px;color:var(--muted);margin-top:3px}
  .kpi.alert .v{color:var(--crit)} .kpi.warn .v{color:var(--low)} .kpi.good .v{color:var(--ok)}
  .grid{display:grid;grid-template-columns:1.05fr 1fr;gap:16px}
  .card{background:var(--card);border-radius:14px;border:1px solid var(--line);
        box-shadow:0 1px 3px rgba(16,32,44,.05);overflow:hidden}
  .card h2{font-size:13px;margin:0;padding:14px 18px;border-bottom:1px solid var(--line);
           text-transform:uppercase;letter-spacing:.5px;color:var(--navy);font-weight:700}
  .card .body{padding:14px 18px}
  #map{height:430px;width:100%}
  .chartwrap{position:relative;height:300px;padding:8px 4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:600}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .grp{font-weight:700;color:var(--navy)}
  .bk{font-weight:600;color:var(--ink);line-height:1.2}
  .sub2{font-size:11px;color:var(--muted);margin-top:2px}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .legend{font-size:11px;color:var(--muted);padding:8px 18px;border-top:1px solid var(--line);
          display:flex;gap:16px;flex-wrap:wrap}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
  footer{color:var(--muted);font-size:11.5px;text-align:center;padding:22px;max-width:1380px;margin:0 auto}
  .note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;
        padding:9px 13px;font-size:12px;margin-bottom:16px}
  @media(max-width:1000px){.kpis{grid-template-columns:repeat(2,1fr)}.grid,.row2{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <svg class="drop" viewBox="0 0 24 24" fill="#ff5269"><path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>
  <div><h1>Blood Supply Command Center</h1><div class="sub" id="subhead"></div></div>
  <div class="spacer"></div>
  <div class="toggle" id="scopeToggle">
    <button data-scope="india">🇮🇳 India</button>
    <button data-scope="telangana">📍 Telangana</button>
  </div>
  <div class="scenario" id="scenarioBox">
    <label for="scn">Demand scenario</label><select id="scn"></select>
  </div>
</header>
<main>
  <div class="note" id="note"></div>
  <div class="kpis" id="kpis"></div>
  <div class="grid">
    <div class="card"><h2 id="leftTitle"></h2><div class="chartwrap"><canvas id="covChart"></canvas></div></div>
    <div class="card"><h2 id="mapTitle"></h2><div id="map"></div>
      <div class="legend" id="legend"></div></div>
  </div>
  <div class="row2">
    <div class="card"><h2 id="tableTitle"></h2>
      <div class="body" style="max-height:340px;overflow:auto"><table id="transfers"></table></div></div>
    <div class="card"><h2 id="rightTitle"></h2>
      <div class="body"><div class="chartwrap" style="height:240px"><canvas id="rightChart"></canvas></div>
        <div id="rightNote" style="text-align:center;color:var(--muted);font-size:12px;margin-top:6px"></div></div></div>
  </div>
</main>
<footer id="foot"></footer>

<script>
const DATA = __DATA__;
const SC = {CRITICAL:'#e5484d', LOW:'#f5a524', OK:'#17b26a'};
let covChart, rightChart, map, markerLayer, flowLayer;
let scope='india', scenarioKey=DATA.telangana.default_scenario;

function fmt(n){ if(n===null||n===undefined) return '—';
  return (typeof n==='number') ? n.toLocaleString(undefined,{maximumFractionDigits:0}) : n; }

function initMap(){
  map=L.map('map',{scrollWheelZoom:false}).setView([22,80],5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {attribution:'© OpenStreetMap © CARTO',maxZoom:12}).addTo(map);
  markerLayer=L.layerGroup().addTo(map); flowLayer=L.layerGroup().addTo(map);
}
function kpiHTML(cards){
  return cards.map(c=>'<div class="kpi '+(c.cls||'')+'"><div class="v">'+c.v+
    '</div><div class="l">'+c.l+'</div><div class="t">'+c.t+'</div></div>').join('');
}

/* ---------------- INDIA scope ---------------- */
function renderIndia(){
  const d=DATA.india, k=d.kpis;
  document.getElementById('note').innerHTML='<b>National view</b> — supply &amp; safety-stock rebalance across all scraped states. '+
    'Demand-driven shortage analysis is shown under <b>📍 Telangana</b> (the only region with patient-demand data).';
  document.getElementById('kpis').innerHTML=kpiHTML([
    {v:fmt(k.states),l:'States covered',t:'national inventory'},
    {v:fmt(k.banks),l:'Blood banks',t:fmt(k.total_units)+' red-cell units'},
    {v:fmt(k.units_moved),l:'Rebalance units',t:k.transfers.toLocaleString()+' bank transfers'},
    {v:fmt(k.banks_below_safety),l:'Bank×group below safety',t:'< '+d.safety_stock+' u/group',cls:'warn'},
    {v:fmt(k.total_units),l:'Total units in stock',t:'nationwide red cells'},
  ]);
  document.getElementById('leftTitle').textContent='National red-cell supply by blood group';
  document.getElementById('mapTitle').textContent='National supply & rebalance map';
  document.getElementById('tableTitle').textContent='Top safety-stock rebalance transfers';
  document.getElementById('rightTitle').textContent='Top states by units in stock';
  document.getElementById('legend').innerHTML='<span>circle size ∝ units in stock</span>'+
    '<span><span class="dot" style="background:#13355c"></span>inter-state rebalance flow</span>';
  // supply by group chart
  const g=d.by_group;
  if(covChart) covChart.destroy();
  covChart=new Chart(document.getElementById('covChart'),{type:'bar',
    data:{labels:g.map(x=>x.group),datasets:[{data:g.map(x=>x.units),backgroundColor:'#e63148',borderRadius:5,barThickness:22}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>' '+fmt(c.raw)+' units in stock'}}},
      scales:{x:{title:{display:true,text:'units in stock'},grid:{color:'#eef2f7'}},y:{grid:{display:false},ticks:{font:{weight:'700'}}}}}});
  // map
  markerLayer.clearLayers(); flowLayer.clearLayers(); map.setView([22.5,80],4.4);
  const byName={}; d.states.forEach(s=>byName[s.name]=s);
  d.state_flows.forEach(f=>{const a=byName[f.from],b=byName[f.to];
    if(a&&b) L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#13355c',weight:Math.min(1+f.units/300,5),opacity:.3}).addTo(flowLayer);});
  const maxU=Math.max(...d.states.map(s=>s.units),1);
  d.states.forEach(s=>{
    const r=8+Math.sqrt(s.units/maxU)*34;
    const tg=s.top_groups.map(x=>x.g+' '+fmt(x.u)).join(', ');
    L.circleMarker([s.lat,s.lng],{radius:r,color:'#fff',weight:1.2,fillColor:'#e63148',fillOpacity:.78})
     .bindPopup('<b>'+s.name+'</b><br>'+fmt(s.units)+' units · '+fmt(s.banks)+' banks<br>'+
                'below safety: '+fmt(s.below_safety)+' bank×group<br><span style="color:#6b7a8d">'+tg+'</span>')
     .addTo(markerLayer);});
  // rebalance transfers table
  const t=d.top_transfers;
  let h='<thead><tr><th>From bank</th><th>To bank</th><th>Grp</th><th class="num">Units</th><th class="num">km</th></tr></thead><tbody>';
  t.forEach(x=>{h+='<tr><td><div class="bk">'+x.from_bank+'</div><div class="sub2">'+x.from_state+'</div></td>'+
    '<td><div class="bk">'+x.to_bank+'</div><div class="sub2">'+x.to_state+'</div></td>'+
    '<td class="grp">'+x.blood_group+'</td><td class="num">'+fmt(x.units)+'</td><td class="num">'+x.distance_km+'</td></tr>';});
  document.getElementById('transfers').innerHTML=h+'</tbody>';
  // top states chart
  const ts=d.top_states;
  if(rightChart) rightChart.destroy();
  rightChart=new Chart(document.getElementById('rightChart'),{type:'bar',
    data:{labels:ts.map(x=>x.name),datasets:[{data:ts.map(x=>x.units),backgroundColor:'#13355c',borderRadius:5}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>' '+fmt(c.raw)+' units'}}},scales:{x:{grid:{color:'#eef2f7'}},y:{grid:{display:false},ticks:{font:{weight:'600'}}}}}});
  document.getElementById('rightNote').textContent='National safety-stock rebalance · inter-state distances are approximate';
}

/* ---------------- TELANGANA scope ---------------- */
function tgColor(d){ if(d.demand-d.supply-d.incoming>0.5||d.donors>0) return '#e5484d';
  if(d.incoming>0) return '#f5a524'; return '#17b26a'; }
function renderTG(){
  const s=DATA.telangana.scenarios[scenarioKey], k=s.kpis;
  document.getElementById('note').textContent=(s.scale===1)
    ? 'Telangana · raw sample demand — statewide supply is healthy; the honest baseline.'
    : 'Telangana · demand projected '+s.scale+'× toward the real ~100k-patient population to stress-test the network.';
  document.getElementById('kpis').innerHTML=kpiHTML([
    {v:k.critical,l:'Critical groups',t:'< 3 days supply',cls:k.critical?'alert':'good'},
    {v:(k.first_shortage_days===null?'—':k.first_shortage_days+'d'),l:'First shortage in',t:'lowest coverage',
      cls:(k.first_shortage_days!==null&&k.first_shortage_days<3)?'alert':(k.first_shortage_days!==null&&k.first_shortage_days<7?'warn':'good')},
    {v:fmt(k.units_moved),l:'Units to redistribute',t:k.transfers+' bank transfers'},
    {v:fmt(k.donors),l:'Donors to mobilize',t:'→ ThalNet outreach',cls:k.donors?'warn':'good'},
    {v:fmt(k.banks),l:'Banks supplying',t:fmt(k.total_supply)+' units in stock'},
  ]);
  document.getElementById('leftTitle').textContent='Coverage by blood group — days of supply';
  document.getElementById('mapTitle').textContent='Telangana district supply & demand';
  document.getElementById('tableTitle').textContent='Recommended bank→bank transfers';
  document.getElementById('rightTitle').textContent='Donor mobilization → ThalNet';
  document.getElementById('legend').innerHTML='<span><span class="dot" style="background:#e5484d"></span>shortfall</span>'+
    '<span><span class="dot" style="background:#f5a524"></span>received transfer</span>'+
    '<span><span class="dot" style="background:#17b26a"></span>covered</span><span>size ∝ demand</span>';
  // coverage chart
  const rows=s.coverage, CAP=60;
  if(covChart) covChart.destroy();
  covChart=new Chart(document.getElementById('covChart'),{type:'bar',
    data:{labels:rows.map(r=>r.group),datasets:[{data:rows.map(r=>r.days===null?CAP:Math.min(r.days,CAP)),
      backgroundColor:rows.map(r=>SC[r.status]),borderRadius:5,barThickness:20}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>{const r=rows[c.dataIndex];return [' '+(r.days===null?'≥60':r.days)+' days ('+r.status+')',
        ' supply '+fmt(r.supply)+' u · demand '+fmt(r.demand)+' u'];}}}},
      scales:{x:{title:{display:true,text:'days of supply (capped at 60)'},grid:{color:'#eef2f7'}},y:{grid:{display:false},ticks:{font:{weight:'700'}}}}}});
  // map
  markerLayer.clearLayers(); flowLayer.clearLayers(); map.setView([17.9,79.2],7);
  const byName={}; s.districts.forEach(d=>byName[d.name]=d);
  s.top_transfers.forEach(t=>{const a=byName[t.from_district],b=byName[t.to_district];
    if(a&&b) L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#13355c',weight:Math.min(1+t.units/40,6),opacity:.35}).addTo(flowLayer);});
  s.districts.forEach(d=>{const r=6+Math.sqrt(d.demand)*1.3;
    L.circleMarker([d.lat,d.lng],{radius:Math.min(r,30),color:'#fff',weight:1.2,fillColor:tgColor(d),fillOpacity:.82})
     .bindPopup('<b>'+d.name+'</b><br>Supply: '+fmt(d.supply)+' u<br>Demand: '+fmt(d.demand)+
                ' u<br>Incoming: '+fmt(d.incoming)+' u<br>Donors: '+fmt(d.donors)).addTo(markerLayer);});
  // transfers table
  const t=s.top_transfers;
  let h='<thead><tr><th>From bank</th><th>To bank</th><th>Grp</th><th class="num">Units</th><th class="num">km</th></tr></thead><tbody>';
  if(!t.length) h+='<tr><td colspan="5" style="color:var(--muted)">No transfers needed — supply is balanced.</td></tr>';
  t.forEach(x=>{h+='<tr><td><div class="bk">'+x.from_bank+'</div><div class="sub2">'+x.from_district+' · '+(x.from_type||'—')+' · cap '+fmt(x.from_capacity)+'</div></td>'+
    '<td><div class="bk">'+x.to_bank+'</div><div class="sub2">'+x.to_district+'</div></td>'+
    '<td class="grp">'+x.blood_group+'</td><td class="num">'+fmt(x.units)+'</td><td class="num">'+x.distance_km+'</td></tr>';});
  document.getElementById('transfers').innerHTML=h+'</tbody>';
  // mobilization chart
  const m=s.mobilization_by_group;
  if(rightChart) rightChart.destroy();
  rightChart=new Chart(document.getElementById('rightChart'),{type:'bar',
    data:{labels:m.map(x=>x.group),datasets:[{data:m.map(x=>x.count),backgroundColor:'#e63148',borderRadius:5,barThickness:22}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>' '+fmt(c.raw)+' donors'}}},scales:{y:{grid:{color:'#eef2f7'},title:{display:true,text:'donors'}},x:{grid:{display:false},ticks:{font:{weight:'700'}}}}}});
  const tot=m.reduce((a,b)=>a+b.count,0);
  document.getElementById('rightNote').textContent=tot?tot.toLocaleString()+' eligible donors selected (nearest-first) for ThalNet':'No mobilization needed at this demand level.';
}

function render(){ if(scope==='india') renderIndia(); else renderTG(); }
function setScope(sc){
  scope=sc;
  document.querySelectorAll('#scopeToggle button').forEach(b=>b.classList.toggle('active',b.dataset.scope===sc));
  document.getElementById('scenarioBox').style.display = sc==='telangana'?'flex':'none';
  render();
}
function boot(){
  document.getElementById('subhead').textContent='Blood Warriors · as-of '+DATA.as_of+' · '+DATA.horizon_days+'-day horizon';
  document.getElementById('foot').textContent='Generated '+DATA.generated_at+
    ' · supply: live e-RaktKosh scrape · demand: patient transfusion schedules (Telangana) · red-cell components · prototype';
  const sel=document.getElementById('scn');
  DATA.telangana.scenario_order.forEach(k=>{const o=document.createElement('option');
    o.value=k;o.textContent=DATA.telangana.scenario_labels[k];sel.appendChild(o);});
  sel.value=scenarioKey;
  sel.addEventListener('change',e=>{scenarioKey=e.target.value;render();});
  document.querySelectorAll('#scopeToggle button').forEach(b=>b.addEventListener('click',()=>setScope(b.dataset.scope)));
  initMap(); setScope('india');
}
boot();
</script>
</body>
</html>"""


if __name__ == "__main__":
    main()
