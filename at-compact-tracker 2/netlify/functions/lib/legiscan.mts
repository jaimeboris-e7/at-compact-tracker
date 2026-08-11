// Shared logic for fetching Athletic Trainer / Athletic Training compact
// bill data from the LegiScan API and normalizing it into the shape the
// frontend expects. Used by both the scheduled daily refresh and the
// manually-triggerable refresh endpoint.

import { getStore } from "@netlify/blobs";

const LEGISCAN_BASE = "https://api.legiscan.com/";

// LegiScan full-text/bill search picks up state variants of the bill title
// ("Athletic Trainers Licensure Compact", "Athletic Training Licensure
// Compact", etc). We run a couple of queries and de-dupe by bill_id.
const SEARCH_QUERIES = [
  "athletic trainer licensure compact",
  "athletic training compact",
];

// USPS postal codes for the 50 states + DC, used to build a complete map
// even for states with zero matching bills ("not introduced").
const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// Maps a LegiScan bill onto one of our tracker's status buckets.
// LegiScan status_id: 1 Introduced, 2 Engrossed, 3 Enrolled, 4 Passed, 5 Vetoed, 6 Failed/Dead
function classifyStatus(bill: any): string {
  const statusId = bill.status;
  const history: any[] = bill.history || bill.progress || [];
  const text = JSON.stringify(history).toLowerCase();

  const chamberPassages = history.filter((h: any) =>
    /passed|adopted|third reading/.test((h.action || "").toLowerCase())
  ).length;

  if (statusId === 4 || /signed by governor|chapter law|act no\./.test(text)) {
    return "enacted";
  }
  if (statusId === 5) return "vetoed";
  if (statusId === 6) return "failed";
  if (statusId === 3 || chamberPassages >= 2) return "passed_legislature";
  if (chamberPassages === 1) return "passed_one_chamber";
  if (statusId === 1 || statusId === 2) return "introduced";
  return "introduced";
}

async function legiscanRequest(apiKey: string, params: Record<string, string>) {
  const url = new URL(LEGISCAN_BASE);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`LegiScan request failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (json.status !== "OK") {
    throw new Error(`LegiScan API error: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function fetchAndStoreCompactData(): Promise<{
  billCount: number;
  stateCount: number;
  fetchedAt: string;
}> {
  const apiKey = process.env.LEGISCAN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LEGISCAN_API_KEY environment variable is not set. Add it in " +
        "Netlify site settings (Site configuration > Environment variables)."
    );
  }

  // 1. Search nationwide for candidate bills.
  const billIdSet = new Map<number, { relevance: number }>();
  for (const query of SEARCH_QUERIES) {
    const json = await legiscanRequest(apiKey, {
      op: "getSearch",
      state: "ALL",
      query,
    });
    const results = json.searchresult || {};
    for (const key of Object.keys(results)) {
      if (key === "summary") continue;
      const item = results[key];
      if (item?.bill_id) {
        billIdSet.set(item.bill_id, { relevance: item.relevance ?? 0 });
      }
    }
  }

  // 2. Pull full details for each candidate bill.
  const byState: Record<string, any[]> = {};
  for (const state of ALL_STATES) byState[state] = [];

  for (const billId of billIdSet.keys()) {
    try {
      const detail = await legiscanRequest(apiKey, {
        op: "getBill",
        id: String(billId),
      });
      const bill = detail.bill;
      if (!bill) continue;

      // Filter out false-positive matches (e.g. unrelated "compact" bills)
      // by requiring both key terms to appear somewhere in the title/description.
      const haystack = `${bill.title || ""} ${bill.description || ""}`.toLowerCase();
      const looksRelevant =
        haystack.includes("athletic train") && haystack.includes("compact");
      if (!looksRelevant) continue;

      const state = bill.state;
      if (!byState[state]) byState[state] = [];

      byState[state].push({
        billId: bill.bill_id,
        billNumber: bill.bill_number,
        title: bill.title,
        description: bill.description,
        status: classifyStatus(bill),
        lastAction: bill.status_date || bill.last_action_date || null,
        lastActionText: bill.history?.length
          ? bill.history[bill.history.length - 1].action
          : null,
        session: bill.session?.session_name || null,
        url: bill.state_link || bill.url,
        sponsors: (bill.sponsors || []).map((s: any) => s.name),
      });
    } catch (err) {
      // Skip individual bill failures rather than failing the whole run.
      console.error(`Failed to fetch bill ${billId}:`, err);
    }
  }

  // 3. Reduce each state to a single "best" status (highest-progress bill wins),
  // while keeping the full bill list for the detail view.
  const STATUS_RANK: Record<string, number> = {
    enacted: 5,
    passed_legislature: 4,
    passed_one_chamber: 3,
    introduced: 2,
    vetoed: 1,
    failed: 1,
    not_introduced: 0,
  };

  const states = ALL_STATES.map((code) => {
    const bills = byState[code] || [];
    let bestStatus = "not_introduced";
    for (const b of bills) {
      if (STATUS_RANK[b.status] > STATUS_RANK[bestStatus]) bestStatus = b.status;
    }
    return { state: code, status: bestStatus, bills };
  });

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: "LegiScan API",
    states,
  };

  const store = getStore({ name: "at-compact-data", consistency: "strong" });
  await store.setJSON("latest.json", payload);

  const billCount = states.reduce((sum, s) => sum + s.bills.length, 0);
  const stateCount = states.filter((s) => s.status !== "not_introduced").length;
  return { billCount, stateCount, fetchedAt: payload.fetchedAt };
}
