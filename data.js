/* ThalNet — mock data. Realistic-feeling; swap with real API payloads later.
   Hyderabad / Telangana context. Names, hospitals, blood banks are invented. */

window.TN = (function () {

  // ---- Donor pool for the focused patient's Blood Bridge (8 of 9 slots) ----
  // status: confirmed | scheduled | contacted | resting | lapsed | empty
  const bridgeDonors = [
    { id: "d1", name: "Ravi Teja",        group: "O+", km: 3.2,  status: "confirmed", note: "Confirmed for Jun 18", lastDonated: "Mar 4", responsiveness: 0.94, churn: 0.08 },
    { id: "d2", name: "Sneha Reddy",      group: "O+", km: 5.8,  status: "scheduled", note: "Slot reserved · Jun 21", lastDonated: "Feb 26", responsiveness: 0.88, churn: 0.12 },
    { id: "d3", name: "Imran Khan",       group: "O-", km: 7.1,  status: "confirmed", note: "Confirmed for Jun 19", lastDonated: "Mar 12", responsiveness: 0.81, churn: 0.18 },
    { id: "d4", name: "Anjali Nair",      group: "O+", km: 2.4,  status: "resting",   note: "Eligible again Jun 30", lastDonated: "May 9", responsiveness: 0.9, churn: 0.1 },
    { id: "d5", name: "Karthik Varma",    group: "O+", km: 9.6,  status: "contacted", note: "Outreach sent · awaiting reply", lastDonated: "Jan 30", responsiveness: 0.64, churn: 0.34 },
    { id: "d6", name: "Pooja Sharma",     group: "O-", km: 11.2, status: "resting",   note: "Eligible again Jun 24", lastDonated: "May 3", responsiveness: 0.86, churn: 0.15 },
    { id: "d7", name: "Sai Krishna",      group: "O+", km: 6.7,  status: "lapsed",    note: "No reply in 3 cycles", lastDonated: "Oct 11", responsiveness: 0.22, churn: 0.79 },
    { id: "d8", name: "Meghana Rao",      group: "O+", km: 4.5,  status: "contacted", note: "Outreach sent · Telugu", lastDonated: "Feb 2", responsiveness: 0.71, churn: 0.27 },
    { id: "d9", name: null,               group: "O+", km: null, status: "empty",     note: "AI is sourcing a candidate", lastDonated: null, responsiveness: null, churn: null },
  ];

  // ---- Focused patient ----
  const patient = {
    id: "p_anaya",
    name: "Anaya Kulkarni",
    age: 9,
    group: "O+",
    city: "Secunderabad, Telangana",
    hospital: "Center for Thalassemia & Blood Disorders",
    diagnosis: "Beta Thalassemia Major",
    cadence: 22,            // transfusion every ~22 days
    nextTransfusion: "Jun 18, 2026",
    daysToTransfusion: 4,
    lifetimeTransfusions: 168,
    unitsThisCycle: 2,
    bridge: {
      integrity: 78,        // 0-100
      health: "at-risk",    // full | at-risk | broken
      target: 9,
      confirmed: 2,
      scheduled: 1,
      contacted: 2,
      resting: 2,
      lapsed: 1,
      empty: 1,
    },
    timeline: [
      { day: "Today", title: "AI confirmed Ravi Teja for Jun 18", kind: "confirmed", time: "9:12 AM" },
      { day: "Today", title: "Outreach sent to Karthik & Meghana", kind: "agent", time: "8:40 AM" },
      { day: "Yesterday", title: "Sai Krishna marked lapsed — bridge self-healing", kind: "alert", time: "6:20 PM" },
      { day: "Jun 2", title: "Transfusion completed · 2 units", kind: "done", time: "11:05 AM" },
    ],
  };

  // ---- Donor's own view (the person using the app) ----
  const me = {
    id: "d_arjun",
    name: "Arjun Mehta",
    group: "O+",
    city: "Begumpet, Hyderabad",
    eligibleInDays: 12,
    eligibleDate: "Jun 18, 2026",
    lastDonated: "Apr 5, 2026",
    cycleDays: 90,
    daysSince: 78,
    unitsDonated: 11,
    patientsHelped: 6,
    firstDonation: "2023",
    // anticipatory match — the killer feature
    match: {
      patientInitial: "A",
      group: "O+",
      km: 4,
      neededDate: "Jun 18, 2026",
      hospital: "Center for Thalassemia & Blood Disorders",
      area: "Secunderabad",
    },
    history: [
      { date: "Apr 5, 2026",  place: "Aarohi Blood Center, Ameerpet", units: 1, reached: "A child in Secunderabad" },
      { date: "Jan 8, 2026",  place: "Red Cross, Vijayawada Rd",       units: 1, reached: "A patient in Malakpet" },
      { date: "Oct 2, 2025",  place: "Aarohi Blood Center, Ameerpet",  units: 1, reached: "A teenager in Kukatpally" },
      { date: "Jul 6, 2025",  place: "NTR Trust Blood Bank",            units: 1, reached: "A child in Secunderabad" },
    ],
  };

  // ---- Admin: all patient bridges at a glance ----
  const bridges = [
    { id: "b1", patient: "Anaya K.",   group: "O+", area: "Secunderabad", integrity: 78, health: "at-risk", confirmed: 3, target: 9, next: "Jun 18", flag: "1 lapsed donor" },
    { id: "b2", patient: "Vikram S.",  group: "B+", area: "Kukatpally",   integrity: 96, health: "full",    confirmed: 9, target: 9, next: "Jun 20", flag: null },
    { id: "b3", patient: "Fatima R.",  group: "A+", area: "Malakpet",     integrity: 41, health: "broken",  confirmed: 2, target: 8, next: "Jun 16", flag: "Escalated · 3 failed cycles" },
    { id: "b4", patient: "Dev P.",     group: "O-", area: "Gachibowli",   integrity: 88, health: "full",    confirmed: 8, target: 9, next: "Jun 23", flag: null },
    { id: "b5", patient: "Sara M.",    group: "AB+", area: "Dilsukhnagar", integrity: 67, health: "at-risk", confirmed: 5, target: 8, next: "Jun 19", flag: "2 awaiting reply" },
    { id: "b6", patient: "Rohan G.",   group: "B-", area: "Miyapur",      integrity: 92, health: "full",    confirmed: 8, target: 8, next: "Jun 25", flag: null },
  ];

  // ---- Admin: churn alerts with recommended actions ----
  // action: contact | wait | appreciate | dnd
  const churnAlerts = [
    { id: "c1", donor: "Sai Krishna",  group: "O+", churn: 0.79, reason: "No reply in 3 outreach cycles", action: "dnd",        rec: "Mark Do-Not-Disturb · stop outreach", bridge: "Anaya K." },
    { id: "c2", donor: "Karthik Varma", group: "O+", churn: 0.34, reason: "Slower replies, missed last slot", action: "contact",   rec: "Call now — responsive to voice", bridge: "Anaya K." },
    { id: "c3", donor: "Deepak Joshi",  group: "B+", churn: 0.18, reason: "Eligible in 2 days, usually says yes", action: "wait",     rec: "Wait — auto-outreach scheduled", bridge: "Vikram S." },
    { id: "c4", donor: "Lakshmi Iyer",  group: "A+", churn: 0.06, reason: "10th donation milestone reached", action: "appreciate", rec: "Send a thank-you note", bridge: "Fatima R." },
  ];

  // ---- Admin: agent activity feed (mono, quiet) ----
  const agentFeed = [
    { t: "09:12", msg: "transfusion-due → built outreach batch for Anaya K. (3 donors)", ok: true },
    { t: "09:12", msg: "donor Ravi Teja replied YES (EN) → confirmed Jun 18", ok: true },
    { t: "08:40", msg: "emergency-rank → re-scored O+ pool within 12km", ok: true },
    { t: "08:39", msg: "outreach Meghana Rao (TE) → delivered, awaiting reply", ok: true },
    { t: "08:21", msg: "heal-bridge → Sai Krishna churn 0.79, queued for review", ok: false },
    { t: "07:55", msg: "learning → updated responsiveness weights from 142 outcomes", ok: true },
  ];

  // ---- Admin: supply intelligence ----
  const supply = {
    nationalBanks: 3863,
    stockRows: 44675,
    regional: [
      { group: "O+", units: 312, status: "ok" },
      { group: "O-", units: 38,  status: "low" },
      { group: "A+", units: 201, status: "ok" },
      { group: "A-", units: 24,  status: "low" },
      { group: "B+", units: 188, status: "ok" },
      { group: "B-", units: 41,  status: "watch" },
      { group: "AB+", units: 96, status: "ok" },
      { group: "AB-", units: 12, status: "critical" },
    ],
    banks: [
      { name: "Aarohi Blood Center", area: "Ameerpet", km: 2.1, open: true,  units: 64 },
      { name: "Red Cross Blood Bank", area: "Vijayawada Rd", km: 4.6, open: true,  units: 120 },
      { name: "NTR Trust Blood Bank", area: "Banjara Hills", km: 6.3, open: false, units: 38 },
      { name: "Chiranjeevi Blood Bank", area: "Jubilee Hills", km: 7.8, open: true, units: 91 },
    ],
    prediction: { group: "O-", area: "central Hyderabad", window: "5–7 days", note: "Demand trending above supply" },
  };

  const adminStats = {
    activeRequests: 14,
    bridgesTotal: 47,
    bridgesFull: 31,
    bridgesAtRisk: 11,
    bridgesBroken: 5,
    donorPool: 1284,
    donorsActive: 968,
    escalations: 3,
    outreachToday: 52,
    confirmedToday: 19,
  };

  return { bridgeDonors, patient, me, bridges, churnAlerts, agentFeed, supply, adminStats };
})();
