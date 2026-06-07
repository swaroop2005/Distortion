/* ThalNet — Admin mock data. Swap with FastAPI responses later. */
window.AD = (function () {

  const stats = {
    totalPatients: 84, totalDonors: 4446, eligibleNow: 1847,
    bridgesActive: 71, bridgesAtRisk: 8, bridgesBroken: 5,
    upcomingWeek: 12, responseRate30d: 73, acceptRate30d: 61,
    outreachToday: 148, confirmedToday: 91, escalationsOpen: 3,
  };

  const bridges = [
    { pid:"P-001", name:"Anaya K.",   group:"O+",  size:7,  target:9,  integrity:"at-risk", nextTx:"Jun 9",  lastHealed:"Jun 1",  confirmed:3, pending:2 },
    { pid:"P-002", name:"Vikram S.",  group:"B+",  size:9,  target:9,  integrity:"full",    nextTx:"Jun 11", lastHealed:"May 28", confirmed:9, pending:0 },
    { pid:"P-003", name:"Fatima R.",  group:"A+",  size:3,  target:8,  integrity:"broken",  nextTx:"Jun 7",  lastHealed:"May 10", confirmed:2, pending:1 },
    { pid:"P-004", name:"Dev P.",     group:"O-",  size:8,  target:9,  integrity:"full",    nextTx:"Jun 14", lastHealed:"May 31", confirmed:8, pending:0 },
    { pid:"P-005", name:"Sara M.",    group:"AB+", size:5,  target:8,  integrity:"at-risk", nextTx:"Jun 10", lastHealed:"May 25", confirmed:4, pending:2 },
    { pid:"P-006", name:"Rohan G.",   group:"B-",  size:8,  target:8,  integrity:"full",    nextTx:"Jun 16", lastHealed:"Jun 2",  confirmed:8, pending:0 },
    { pid:"P-007", name:"Priya N.",   group:"O+",  size:6,  target:9,  integrity:"at-risk", nextTx:"Jun 8",  lastHealed:"May 20", confirmed:5, pending:3 },
    { pid:"P-008", name:"Karan V.",   group:"A-",  size:9,  target:9,  integrity:"full",    nextTx:"Jun 19", lastHealed:"May 29", confirmed:9, pending:0 },
    { pid:"P-009", name:"Meera J.",   group:"O+",  size:2,  target:8,  integrity:"broken",  nextTx:"Jun 8",  lastHealed:"Apr 30", confirmed:1, pending:0 },
    { pid:"P-010", name:"Amir S.",    group:"B+",  size:7,  target:8,  integrity:"full",    nextTx:"Jun 21", lastHealed:"Jun 1",  confirmed:7, pending:0 },
    { pid:"P-011", name:"Divya L.",   group:"AB-", size:4,  target:7,  integrity:"at-risk", nextTx:"Jun 12", lastHealed:"May 18", confirmed:3, pending:2 },
    { pid:"P-012", name:"Tejas B.",   group:"O+",  size:8,  target:9,  integrity:"full",    nextTx:"Jun 23", lastHealed:"Jun 3",  confirmed:8, pending:0 },
    { pid:"P-013", name:"Zoya H.",    group:"A+",  size:1,  target:8,  integrity:"broken",  nextTx:"Jun 7",  lastHealed:"Mar 12", confirmed:1, pending:0 },
    { pid:"P-014", name:"Siddharth R.", group:"B+", size:8, target:8, integrity:"full",    nextTx:"Jun 25", lastHealed:"May 27", confirmed:8, pending:0 },
    { pid:"P-015", name:"Kavya M.",   group:"O-",  size:6,  target:9,  integrity:"at-risk", nextTx:"Jun 13", lastHealed:"May 22", confirmed:5, pending:2 },
  ];

  const churnAlerts = [
    { did:"D-234", name:"Sai Krishna",   group:"O+", churn:0.81, responsiveness:0.19, lastContact:"Apr 30", action:"dnd",        reason:"No reply in 3 cycles. Outreach fatigue likely." },
    { did:"D-567", name:"Karthik Varma", group:"O+", churn:0.61, responsiveness:0.44, lastContact:"May 14", action:"contact",    reason:"Slowing. Responded to voice 2 cycles ago." },
    { did:"D-891", name:"Deepak Joshi",  group:"B+", churn:0.38, responsiveness:0.72, lastContact:"May 28", action:"wait",       reason:"Eligible in 2 days, usually accepts." },
    { did:"D-102", name:"Lakshmi Iyer",  group:"A+", churn:0.12, responsiveness:0.88, lastContact:"Jun 2",  action:"appreciate", reason:"10th donation. High value, strengthen bond." },
    { did:"D-445", name:"Riya Shah",     group:"O-", churn:0.54, responsiveness:0.36, lastContact:"May 10", action:"contact",    reason:"Blood group scarce — O-. Worth direct call." },
    { did:"D-778", name:"Harish Rao",    group:"B-", churn:0.29, responsiveness:0.61, lastContact:"May 31", action:"wait",       reason:"Traveling this week per last SMS. Wait 5 days." },
  ];

  const urgentTx = [
    { pid:"P-003", name:"Fatima R.",  group:"A+",  date:"Jun 7",  bridge:"broken",  confirmed:2, needed:8,  hospital:"Gandhi Hospital, Secunderabad" },
    { pid:"P-013", name:"Zoya H.",   group:"A+",  date:"Jun 7",  bridge:"broken",  confirmed:1, needed:8,  hospital:"Niloufer Hospital, Hyderabad" },
    { pid:"P-007", name:"Priya N.",  group:"O+",  date:"Jun 8",  bridge:"at-risk", confirmed:5, needed:9,  hospital:"KIMS, Secunderabad" },
    { pid:"P-009", name:"Meera J.",  group:"O+",  date:"Jun 8",  bridge:"broken",  confirmed:1, needed:8,  hospital:"Yashoda Hospitals, Malakpet" },
    { pid:"P-001", name:"Anaya K.", group:"O+",  date:"Jun 9",  bridge:"at-risk", confirmed:3, needed:9,  hospital:"Center for Thalassemia, Secunderabad" },
    { pid:"P-005", name:"Sara M.",   group:"AB+", date:"Jun 10", bridge:"at-risk", confirmed:4, needed:8,  hospital:"Care Hospitals, Banjara Hills" },
    { pid:"P-002", name:"Vikram S.", group:"B+",  date:"Jun 11", bridge:"full",    confirmed:9, needed:9,  hospital:"AIIMS Hyderabad" },
  ];

  const agentFeed = [
    { ts:"09:41", phase:"OUTREACH",  ok:true,  msg:"Contacted D-234 for P-001's transfusion on Jun 9 (Telugu SMS)" },
    { ts:"09:40", phase:"OUTREACH",  ok:true,  msg:"D-445 replied YES — mapped to P-003's bridge (slot 4)" },
    { ts:"09:38", phase:"TRIAGE",    ok:true,  msg:"Ranked 14 O+ donors within 8km for P-009 (Jun 8 urgent)" },
    { ts:"09:35", phase:"ESCALATE",  ok:false, msg:"P-013 bridge still broken after 2 cycles — queued for human review" },
    { ts:"09:32", phase:"OUTREACH",  ok:true,  msg:"D-567 declined (traveling). Finding replacement for P-001" },
    { ts:"09:30", phase:"OUTREACH",  ok:true,  msg:"3 donors accepted for P-007 — bridge at-risk → recovering" },
    { ts:"09:21", phase:"LEARN",     ok:true,  msg:"Updated responsiveness weights from 142 closed cycles" },
    { ts:"09:18", phase:"TRIAGE",    ok:true,  msg:"Supply alert: O- stock low at Aarohi. Flagged 3 bridges." },
    { ts:"09:12", phase:"OUTREACH",  ok:true,  msg:"Morning batch sent: 52 outreach messages (EN:31 HI:9 TE:12)" },
    { ts:"08:55", phase:"LEARN",     ok:true,  msg:"Decline reason parsed: 'traveling' up 12% this week" },
    { ts:"08:41", phase:"ESCALATE",  ok:false, msg:"P-003 transfusion Jun 7 — bridge broken, escalated to coordinator" },
    { ts:"08:30", phase:"TRIAGE",    ok:true,  msg:"Daily bridge audit complete: 71 full, 8 at-risk, 5 broken" },
  ];

  const supply = {
    regional: [
      { group:"O+",  units:312, max:400, status:"ok" },
      { group:"O-",  units:38,  max:200, status:"low" },
      { group:"A+",  units:201, max:300, status:"ok" },
      { group:"A-",  units:24,  max:150, status:"low" },
      { group:"B+",  units:188, max:280, status:"ok" },
      { group:"B-",  units:41,  max:180, status:"watch" },
      { group:"AB+", units:96,  max:200, status:"ok" },
      { group:"AB-", units:12,  max:120, status:"critical" },
    ],
    banks: [
      { name:"Aarohi Blood Center",     area:"Ameerpet",     km:2.1, open:true,  units:64,  groups:["O+","B+","A+"] },
      { name:"Red Cross Blood Bank",     area:"Vijayawada Rd", km:4.6, open:true,  units:120, groups:["O+","O-","A+","B+"] },
      { name:"NTR Trust Blood Bank",     area:"Banjara Hills", km:6.3, open:false, units:38,  groups:["O+","B-"] },
      { name:"Chiranjeevi Blood Bank",   area:"Jubilee Hills", km:7.8, open:true,  units:91,  groups:["A+","AB+","O+"] },
    ],
    shortages: [
      { group:"AB-", severity:"critical", note:"Only 12 units. 2 patients need AB- within 5 days." },
      { group:"O-",  severity:"low",      note:"38 units, trending down. Pre-mobilising O- donors." },
      { group:"A-",  severity:"low",      note:"24 units. Watch closely — 1 A- bridge at-risk." },
    ],
  };

  const learning = [
    { insight:"O+ donors in Secunderabad respond best on weekday mornings (8–10 AM)", trend:"up", delta:"+8% accept rate" },
    { insight:"Decline rate increased 15% this month. Top reason: traveling (parsed from 67 SMS replies)", trend:"down", delta:"-15% vs May" },
    { insight:"Telugu outreach gets 24% faster reply than Hindi in Hyderabad East zones", trend:"up", delta:"+24% speed" },
    { insight:"Donors who donated in last 90 days accept 2.3× more often than lapsed donors", trend:"neutral", delta:"stable signal" },
  ];

  const acceptRateTrend = [58,61,63,59,62,65,67,64,68,70,69,71,73,61];

  return { stats, bridges, churnAlerts, urgentTx, agentFeed, supply, learning, acceptRateTrend };
})();
