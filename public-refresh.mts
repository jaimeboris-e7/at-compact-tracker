// Public-facing refresh trigger — safe for anyone to click, unlike
// trigger-refresh.mts (which is secret-protected and always re-hits
// LegiScan). This one enforces a cooldown: if the stored data was fetched
// more recently than COOLDOWN_HOURS ago, it just returns the existing data
// without calling LegiScan again. That means no matter how many visitors
// click the button, or how often, LegiScan only actually gets hit at the
// same cadence as the cooldown — protecting your monthly quota from abuse
// while still letting visitors force a fresher pull between scheduled runs.

import { getStore } from "@netlify/blobs";
import { fetchAndStoreCompactData } from "./lib/legiscan.mts";

const COOLDOWN_HOURS = 6;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

const CORS_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

export default async (req: Request) => {
  const store = getStore({ name: "at-compact-data", consistency: "strong" });

  try {
    const current = await store.get("latest.json", { type: "json" });
    if (current?.fetchedAt) {
      const age = Date.now() - new Date(current.fetchedAt).getTime();
      if (age < COOLDOWN_MS) {
        const nextAllowedAt = new Date(new Date(current.fetchedAt).getTime() + COOLDOWN_MS);
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "cooldown",
            fetchedAt: current.fetchedAt,
            nextAllowedAt: nextAllowedAt.toISOString(),
          }),
          { headers: CORS_HEADERS }
        );
      }
    }
  } catch (err) {
    // If we can't read the existing store for some reason, fall through and
    // attempt a real refresh rather than blocking the request.
    console.error("public-refresh: failed to read existing data, proceeding anyway", err);
  }

  try {
    const result = await fetchAndStoreCompactData();
    return new Response(JSON.stringify({ ok: true, skipped: false, ...result }), {
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error("public-refresh failed:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
