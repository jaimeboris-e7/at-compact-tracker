// One-off script to generate public/data/sample-status.json from
// researched real bill data. Not part of the deployed app — just used to
// seed realistic sample data before a LegiScan key is wired up.
import { writeFile } from "node:fs/promises";

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",
};

// Researched via LegiScan + state legislature sources, July 2026.
const KNOWN_BILLS = {
  SD: [{
    billNumber: "HB1149", title: "Adopt the athletic trainer licensure compact.",
    description: "Establishes an interstate compact for athletic trainer licensure in South Dakota.",
    status: "enacted", lastAction: "2026-03-30",
    lastActionText: "Signed by the Governor (H.J. 578)",
    session: "2026 Regular Session",
    url: "https://legiscan.com/SD/bill/HB1149/2026", sponsors: [],
  }],
  VA: [{
    billNumber: "HB574", title: "Athletic Trainer Compact; authorizes Virginia to become a signatory to Compact.",
    description: "Permits Virginia to join the Athletic Trainer Compact.",
    status: "enacted", lastAction: "2026-04-06",
    lastActionText: "Approved by Governor, Chapter 176 of the Acts of Assembly",
    session: "2026 Regular Session",
    url: "https://legiscan.com/VA/bill/HB574/2026", sponsors: [],
  }],
  IA: [{
    billNumber: "SF2139", title: "An act enacting the athletic trainer compact.",
    description: "Senate companion that was substituted for HF2600/HSB672 and enacted.",
    status: "enacted", lastAction: "2026-05-15",
    lastActionText: "Signed by the Governor",
    session: "2025-2026, 91st General Assembly",
    url: "https://legiscan.com/IA/bill/SF2139/2025", sponsors: [],
  }],
  AL: [{
    billNumber: "SB160", title: "Athletic Trainer Licensure Compact",
    description: "Establishes an interstate licensure compact for athletic trainers.",
    status: "enacted", lastAction: "2026-03-17",
    lastActionText: "Enacted; signed by the Governor",
    session: "2026 Regular Session",
    url: "https://legiscan.com/AL/bill/SB160/2026", sponsors: [],
  }],
  NJ: [{
    billNumber: "S4113", title: "Enters NJ into Athletic Trainer Compact.",
    description: "Enters New Jersey into the Athletic Trainer Compact (companion to A4821, which was substituted).",
    status: "passed_legislature", lastAction: "2026-06-30",
    lastActionText: "Passed Assembly 78-0-0; enrolled, awaiting governor's signature",
    session: "2026-2027 Regular Session",
    url: "https://legiscan.com/NJ/bill/S4113/2026", sponsors: [],
  }],
  MO: [{
    billNumber: "HB1844", title: "Establishes a licensure compact for athletic trainers",
    description: "Creates a licensure compact framework for athletic trainers to practice across member states.",
    status: "passed_one_chamber", lastAction: "2026-04-28",
    lastActionText: "Passed House 117-27; public hearing held in Senate committee",
    session: "2026 Regular Session",
    url: "https://legiscan.com/MO/bill/HB1844/2026", sponsors: ["Rep. Sherri Gallick", "Rep. Ladonna Appelbaum"],
  }],
  OH: [{
    billNumber: "SB320", title: "Ratify the Athletic Trainer Compact",
    description: "Allows Ohio to join the Athletic Trainer Compact.",
    status: "passed_one_chamber", lastAction: "2026-05-01",
    lastActionText: "Passed Senate; sent to Ohio House for consideration",
    session: "2025-2026 Regular Session",
    url: "https://www.ohiosenate.gov/members/kristina-d-roegner/news/senate-passes-roegner-bill-ratifying-the-athletic-trainer-compact",
    sponsors: ["Sen. Kristina Roegner"],
  }],
  OK: [{
    billNumber: "SB1813", title: "Professions and occupations; enacting the Athletic Trainer Compact.",
    description: "Establishes the Athletic Trainer Compact for multi-state licensing coordination.",
    status: "failed", lastAction: "2026-04-07",
    lastActionText: "Died in chamber after House committee action; session ended without passage",
    session: "2026 Regular Session",
    url: "https://legiscan.com/OK/bill/SB1813/2026",
    sponsors: ["Sen. Brenda Stanley", "Rep. Ross Ford"],
  }],
  NE: [{
    billNumber: "LB736", title: "Adopt the Athletic Trainer Compact",
    description: "Would adopt the Athletic Trainer Compact in Nebraska.",
    status: "failed", lastAction: "2026-04-17",
    lastActionText: "Indefinitely postponed; provisions folded into LB912 by amendment",
    session: "2025-2026, 109th Legislature",
    url: "https://legiscan.com/NE/bill/LB736/2025", sponsors: [],
  }],
};

const STATUS_RANK = {
  enacted: 5, passed_legislature: 4, passed_one_chamber: 3,
  introduced: 2, vetoed: 1, failed: 1, not_introduced: 0,
};

const states = ALL_STATES.map((code) => {
  const bills = KNOWN_BILLS[code] || [];
  let bestStatus = "not_introduced";
  for (const b of bills) if (STATUS_RANK[b.status] > STATUS_RANK[bestStatus]) bestStatus = b.status;
  return { state: code, name: STATE_NAMES[code], status: bestStatus, bills };
});

const payload = {
  fetchedAt: "2026-07-18T09:00:00.000Z",
  source: "LegiScan API (sample snapshot researched manually, July 2026)",
  states,
};

await writeFile(
  new URL("../public/data/sample-status.json", import.meta.url),
  JSON.stringify(payload, null, 2)
);
console.log("Wrote sample-status.json with", states.length, "states");
