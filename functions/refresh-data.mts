// Scheduled function — runs daily (see netlify.toml) to pull the latest
// Athletic Trainer Compact bill data from LegiScan and store it in Netlify
// Blobs. The public `status` function reads from that store.

import type { Config } from "@netlify/functions";
import { fetchAndStoreCompactData } from "./lib/legiscan.mts";

export default async (req: Request) => {
  try {
    const result = await fetchAndStoreCompactData();
    console.log(
      `Refreshed AT Compact data: ${result.billCount} bills across ${result.stateCount} states at ${result.fetchedAt}`
    );
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("refresh-data failed:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "0 9 * * *",
};
