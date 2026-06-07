/* ThalNet App — comprehensive mock data. Swap with FastAPI at http://localhost:8000 */
window.TNApp = (function () {

  const GROUPS = ["O+","A+","B+","AB+","O-","A-","B-","AB-"];
  const AREAS = [
    {name:"Secunderabad",lat:17.4399,lng:78.4983},{name:"Banjara Hills",lat:17.4156,lng:78.4347},
    {name:"Jubilee Hills",lat:17.4239,lng:78.4067},{name:"Ameerpet",lat:17.4374,lng:78.4487},
    {name:"Kukatpally",lat:17.4849,lng:78.3996},{name:"Dilsukhnagar",lat:17.3687,lng:78.5268},
    {name:"Malakpet",lat:17.3792,lng:78.4974},{name:"LB Nagar",lat:17.3470,lng:78.5517},
    {name:"Miyapur",lat:17.4961,lng:78.3549},{name:"Gachibowli",lat:17.4401,lng:78.3489},
    {name:"Madhapur",lat:17.4478,lng:78.3905},{name:"Mehdipatnam",lat:17.3933,lng:78.4351},
    {name:"Tarnaka",lat:17.4336,lng:78.5348},{name:"Malkajgiri",lat:17.4575,lng:78.5272},
    {name:"Uppal",lat:17.4008,lng:78.5584},
  ];

  const rnd = (min,max) => +(Math.random()*(max-min)+min).toFixed(4);
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];

  const FIRST=["Anaya","Vikram","Fatima","Dev","Sara","Rohan","Priya","Karan","Meera","Amir","Divya","Tejas","Zoya","Siddharth","Kavya","Lakshmi","Arjun","Sneha","Imran","Pooja","Ravi","Meghana","Sai","Karthik","Anjali","Deepak","Riya","Harish","Aisha","Rahul","Suresh","Nandini","Mohan","Rekha","Ajay"];
  const LAST=["Kulkarni","Sharma","Reddy","Mehta","Iyer","Rao","Khan","Nair","Joshi","Shah","Varma","Teja","Hassan","Pillai","Gupta","Patel","Singh","Verma","Murthy","Krishnamurthy"];
  const nm = () => pick(FIRST)+" "+pick(LAST);
  const HOSPITALS=["Center for Thalassemia, Secunderabad","Gandhi Hospital","Niloufer Hospital","KIMS Secunderabad","Yashoda Hospitals","AIIMS Hyderabad","Care Hospitals, Banjara Hills","Aster Prime Hospital","Apollo Hospitals, Jubilee Hills","Manipal Hospital"];

  // 84 patients with coordinates
  const patients = Array.from({length:84},(_,i)=>{
    const area = AREAS[i % AREAS.length];
    const g = GROUPS[i % GROUPS.length];
    const daysNext = 5 + Math.floor(Math.random()*25);
    const txDate = new Date(Date.now() + daysNext*864e5);
    const bridge = ["full","full","full","at-risk","broken"][Math.floor(Math.random()*5)];
    return {
      id:`P-${String(i+1).padStart(3,"0")}`,
      name: nm(), group: g, gender: i%2===0?"Female":"Male",
      age: 6 + Math.floor(Math.random()*22),
      lat: area.lat + rnd(-0.015,0.015),
      lng: area.lng + rnd(-0.015,0.015),
      area: area.name, hospital: HOSPITALS[i%HOSPITALS.length],
      nextTx: txDate.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}),
      daysToTx: daysNext, bridge,
      confirmed: bridge==="full"?8:bridge==="at-risk"?Math.floor(Math.random()*4)+3:Math.floor(Math.random()*3)+1,
      needed:8, phase: daysNext<=7?"urgent":daysNext<=14?"upcoming":"scheduled",
    };
  });

  // 30 displayed donors (out of 4446)
  const donors = Array.from({length:30},(_,i)=>{
    const area = AREAS[i%AREAS.length];
    const eligible = Math.random()>0.45;
    const daysUntil = eligible ? 0 : 10+Math.floor(Math.random()*80);
    const eligDate = new Date(Date.now()+daysUntil*864e5);
    return {
      id:`D-${String(i+100).padStart(3,"0")}`,
      name: nm(), group: GROUPS[i%GROUPS.length], gender: i%2===0?"Male":"Female",
      lat: AREAS[i%AREAS.length].lat + rnd(-0.02,0.02),
      lng: AREAS[i%AREAS.length].lng + rnd(-0.02,0.02),
      area: area.name,
      responsiveness: +(0.4+Math.random()*0.58).toFixed(2),
      churnRisk: +(Math.random()*0.85).toFixed(2),
      eligible, daysUntil, eligibleDate: eligDate.toLocaleDateString("en-IN",{day:"numeric",month:"short"}),
      lastDonated: new Date(Date.now()-(90+Math.floor(Math.random()*180))*864e5).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}),
      totalDonations: 1+Math.floor(Math.random()*18),
      phone: `+91 ${9+Math.floor(Math.random())}${Array.from({length:9},()=>Math.floor(Math.random()*10)).join("")}`,
    };
  });

  // Blood banks
  const banks = [
    {id:"B-01",name:"Aarohi Blood Center",district:"Ameerpet",type:"Private",group:"O+",units:64,phone:"+91 40 2323 1234",lat:17.4374,lng:78.4487,open:true},
    {id:"B-02",name:"Red Cross Blood Bank",district:"Nampally",type:"Red Cross",group:"O+",units:120,phone:"+91 40 2461 6093",lat:17.3950,lng:78.4634,open:true},
    {id:"B-03",name:"NTR Trust Blood Bank",district:"Banjara Hills",type:"Govt",group:"B+",units:38,phone:"+91 40 2354 2211",lat:17.4156,lng:78.4347,open:false},
    {id:"B-04",name:"Chiranjeevi Blood Bank",district:"Jubilee Hills",type:"Private",group:"AB+",units:91,phone:"+91 40 2367 0011",lat:17.4239,lng:78.4067,open:true},
    {id:"B-05",name:"Gandhi Hospital Blood Bank",district:"Secunderabad",type:"Govt",group:"A+",units:205,phone:"+91 40 2770 1011",lat:17.4399,lng:78.4983,open:true},
    {id:"B-06",name:"Hyderabad Blood Bank",district:"Malakpet",type:"Govt",group:"O-",units:22,phone:"+91 40 2452 0000",lat:17.3792,lng:78.4974,open:true},
    {id:"B-07",name:"Care Foundation Bank",district:"Kukatpally",type:"Private",group:"A+",units:77,phone:"+91 40 4488 5555",lat:17.4849,lng:78.3996,open:true},
    {id:"B-08",name:"Aster Prime Blood Bank",district:"Gachibowli",type:"Private",group:"B-",units:31,phone:"+91 40 4441 4444",lat:17.4401,lng:78.3489,open:true},
    {id:"B-09",name:"Apollo Blood Bank",district:"Jubilee Hills",type:"Private",group:"AB-",units:9,phone:"+91 40 2360 7777",lat:17.4200,lng:78.4100,open:true},
    {id:"B-10",name:"Niloufer Hospital Bank",district:"Redbazar",type:"Govt",group:"O+",units:142,phone:"+91 40 2460 5533",lat:17.3840,lng:78.4900,open:true},
  ];

  // Regional supply
  const supply = {
    regional:[
      {group:"O+", units:312,capacity:500,status:"ok"},
      {group:"O-", units:38, capacity:200,status:"low"},
      {group:"A+", units:201,capacity:350,status:"ok"},
      {group:"A-", units:24, capacity:150,status:"low"},
      {group:"B+", units:188,capacity:280,status:"ok"},
      {group:"B-", units:41, capacity:180,status:"watch"},
      {group:"AB+",units:96, capacity:200,status:"ok"},
      {group:"AB-",units:12, capacity:120,status:"critical"},
      {group:"Bombay",units:3,capacity:50,status:"critical"},
    ],
    mobilization:[
      {did:"D-142",name:"Ravi Teja",  group:"O-", priority:0.91,status:"contacted", bridge:"P-009",reason:"O- shortage · 2 patients urgent"},
      {did:"D-267",name:"Anjali N.",  group:"AB-",priority:0.88,status:"confirmed", bridge:"P-031",reason:"AB- critical · 1 patient Jun 8"},
      {did:"D-389",name:"Imran K.",   group:"O+", priority:0.74,status:"pending",   bridge:"P-001",reason:"Jun 9 transfusion · bridge at-risk"},
      {did:"D-412",name:"Pooja S.",   group:"A-", priority:0.71,status:"contacted", bridge:"P-047",reason:"A- low · 3 patients upcoming"},
      {did:"D-534",name:"Harish R.",  group:"B-", priority:0.63,status:"pending",   bridge:"P-062",reason:"B- watch · pre-emptive mobilise"},
      {did:"D-601",name:"Sneha M.",   group:"O+", priority:0.58,status:"confirmed", bridge:"P-003",reason:"Fatima R. bridge broken · Jun 7"},
    ],
  };

  const dashboard = {
    totalDonors:4446, eligibleDonors:1847, totalPatients:84, highChurn:127,
    bridgesFull:57, bridgesAtRisk:18, bridgesBroken:9, totalBridges:84,
    bloodDist:[
      {group:"O+", count:1245},{group:"A+",count:987},{group:"B+",count:756},
      {group:"AB+",count:534},{group:"O-",count:489},{group:"A-",count:267},
      {group:"B-",count:134},{group:"AB-",count:34},
    ],
    urgentPatients: patients.filter(p=>p.daysToTx<=7).slice(0,5),
    churnDonors: donors.filter(d=>d.churnRisk>0.5).slice(0,5),
  };

  return { patients, donors, banks, supply, dashboard };
})();
