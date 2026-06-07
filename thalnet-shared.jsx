/* ThalNet App — shared nav, atoms, layout primitives */
const { useState: useSt, useEffect: useEf, useRef: useRf, useMemo: useMm } = React;

/* ---------- atoms ---------- */
const T = {
  red:"#B91C1C", redV:"#DC2626", redSoft:"#FEF2F2", redMid:"#FEE2E2",
  green:"#059669", greenSoft:"#ECFDF5",
  amber:"#D97706", amberSoft:"#FFFBEB",
  blue:"#2563EB", blueSoft:"#EFF6FF",
  ink:"#111827", soft:"#6B7280", faint:"#9CA3AF",
  line:"#E5E7EB", bg:"#F9FAFB", surface:"#FFFFFF",
  warm:"#FFF7ED",
};

const GRP_COL = {"O+":"#DC2626","O-":"#991B1B","A+":"#2563EB","A-":"#4338CA","B+":"#059669","B-":"#0D9488","AB+":"#7C3AED","AB-":"#DB2777","Bombay":"#D97706"};
const GRP_BG  = {"O+":"#FEF2F2","O-":"#FEF2F2","A+":"#EFF6FF","A-":"#EFF6FF","B+":"#ECFDF5","B-":"#ECFDF5","AB+":"#F5F3FF","AB-":"#FDF2F8","Bombay":"#FFFBEB"};

function Ic({ n, z=18, fill, col, style }) {
  return <span className={"ms"+(fill?" fill":"")} style={{fontSize:z,color:col,...style}}>{n}</span>;
}
function GBadge({ g, style }) {
  const c=GRP_COL[g]||T.ink, bg=GRP_BG[g]||T.bg;
  return <span style={{display:"inline-flex",padding:"3px 9px",borderRadius:99,fontSize:12,fontWeight:700,color:c,background:bg,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"-.01em",...style}}>{g}</span>;
}
function StatusBdg({ v, style }) {
  const m={full:{c:T.green,bg:T.greenSoft,l:"Full"},["at-risk"]:{c:T.amber,bg:T.amberSoft,l:"At risk"},broken:{c:T.red,bg:T.redSoft,l:"Broken"},urgent:{c:T.red,bg:T.redSoft,l:"Urgent"},upcoming:{c:T.amber,bg:T.amberSoft,l:"Upcoming"},scheduled:{c:T.green,bg:T.greenSoft,l:"Scheduled"},confirmed:{c:T.green,bg:T.greenSoft,l:"Confirmed"},contacted:{c:T.amber,bg:T.amberSoft,l:"Contacted"},pending:{c:T.soft,bg:T.bg,l:"Pending"}};
  const s=m[v]||m.pending;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:99,fontSize:12,fontWeight:700,color:s.c,background:s.bg,...style}}><span style={{width:6,height:6,borderRadius:99,background:s.c}}/>{s.l}</span>;
}
function Card({ children, style, pad=20, onClick }) {
  const [h,setH]=useSt(false);
  return <div onClick={onClick} onMouseEnter={()=>onClick&&setH(true)} onMouseLeave={()=>setH(false)} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:pad,boxShadow:h?"0 4px 20px rgba(0,0,0,.09)":"0 1px 3px rgba(0,0,0,.04)",transform:h?"translateY(-2px)":"none",transition:"all .2s",cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function Ava({ nm, sz=34 }) {
  const ini=(nm||"?").split(" ").map(w=>w[0]).slice(0,2).join("");
  const hue=useMm(()=>{let h=0;for(let i=0;i<(nm||"").length;i++)h=(nm.charCodeAt(i)+((h<<5)-h));return Math.abs(h)%360;},[nm]);
  return <div style={{width:sz,height:sz,borderRadius:99,display:"grid",placeItems:"center",background:`oklch(0.9 0.05 ${hue})`,color:`oklch(0.38 0.09 ${hue})`,fontWeight:700,fontSize:sz*0.37,flexShrink:0}}>{ini}</div>;
}
function Skeleton({ w="100%", h=18, r=8, style }) {
  return <div style={{width:w,height:h,borderRadius:r,background:"linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.6s infinite",...style}}/>;
}
function ScoreBar({ v, col }) {
  const c=col||(v>0.6?T.red:v>0.35?T.amber:T.green);
  return <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,borderRadius:99,background:T.line,overflow:"hidden"}}><div style={{width:(v*100)+"%",height:"100%",background:c,borderRadius:99}}/></div><span style={{fontSize:12,fontWeight:700,color:c,minWidth:30}}>{Math.round(v*100)}%</span></div>;
}

/* ---------- navbar ---------- */
const NAV_LINKS=[
  {k:"dashboard",l:"Dashboard",i:"space_dashboard"},
  {k:"patients", l:"Patients",  i:"favorite"},
  {k:"donors",   l:"Donors",    i:"volunteer_activism"},
  {k:"supply",   l:"Supply",    i:"local_hospital"},
  {k:"map",      l:"Map",       i:"map"},
  {k:"command-center", l:"Command Center", i:"hub"},
];
const ROLES=["Patient","Donor","Admin"];

function Navbar({ page, setPage, role, setRole }) {
  const [mob,setMob]=useSt(false);
  return (
    <>
      <nav style={{position:"sticky",top:0,zIndex:200,background:T.surface,borderBottom:`1px solid ${T.line}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",gap:6,height:58}}>
          {/* logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,cursor:"pointer"}} onClick={()=>setPage("dashboard")}>
            <div style={{width:30,height:30,borderRadius:8,background:T.redV,display:"grid",placeItems:"center",boxShadow:"0 2px 5px rgba(185,28,28,.3)"}}>
              <Ic n="water_drop" z={16} fill col="#fff"/>
            </div>
            <span style={{fontWeight:800,fontSize:17,letterSpacing:"-.03em",color:T.ink}}>Thal<span style={{color:T.redV}}>Net</span></span>
          </div>

          {/* desktop nav */}
          <div style={{display:"flex",gap:2,flex:1}}>
            {NAV_LINKS.map(nl=>{
              const active=page===nl.k;
              return <button key={nl.k} onClick={()=>setPage(nl.k)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 13px",borderRadius:10,border:"none",background:active?T.redSoft:"transparent",color:active?T.red:T.soft,fontWeight:active?700:500,fontSize:13.5,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}><Ic n={nl.i} z={16} fill={active} col={active?T.red:T.faint}/>{nl.l}</button>;
            })}
          </div>

          {/* role switcher */}
          <div style={{display:"flex",gap:3,background:T.bg,border:`1px solid ${T.line}`,borderRadius:99,padding:3,marginRight:8}}>
            {ROLES.map(r=>{
              const active=role===r;
              return <button key={r} onClick={()=>setRole(r)} style={{padding:"6px 13px",borderRadius:99,border:"none",background:active?T.redV:"transparent",color:active?"#fff":T.soft,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .16s"}}>{r}</button>;
            })}
          </div>

          <button onClick={()=>setMob(m=>!m)} style={{display:"none",width:36,height:36,borderRadius:8,border:`1px solid ${T.line}`,background:T.bg,cursor:"pointer"}} className="mob-toggle">
            <Ic n={mob?"close":"menu"} z={20} col={T.soft}/>
          </button>
        </div>
      </nav>
      {/* chatbot fab */}
      <button style={{position:"fixed",right:20,bottom:20,zIndex:300,width:56,height:56,borderRadius:99,background:T.redV,border:"none",color:"#fff",display:"grid",placeItems:"center",boxShadow:"0 4px 16px rgba(185,28,28,.4)",cursor:"pointer"}}>
        <Ic n="forum" z={24} fill col="#fff"/>
      </button>
    </>
  );
}

Object.assign(window,{T,GRP_COL,GRP_BG,Ic,GBadge,StatusBdg,Card,Ava,Skeleton,ScoreBar,Navbar});
