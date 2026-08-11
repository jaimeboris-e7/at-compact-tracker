// Manually-triggerable HTTP version of refresh-data, for testing or forcing
// an update without waiting for the daily cron. Protected by a shared
// secret so random visitors can't burn your LegiScan quota.
//
// Call it as: /api/refresh?secret=YOUR_REFRESH_SECRET

import type { Context } from "@netlify/functions";
import { fetchAndStoreCompactData } from "./lib/legiscan.mts";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret");
  const expected = process.env.REFRESH_SECRET;

  if (!expected) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "REFRESH_SECRET is not configured on this site, so manual refresh is disabled.",
      }),
      { status: 501, headers: { "content-type": "application/json" } }
    );
  }

  if (provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const result = await fetchAndStoreCompactData();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("trigger-refresh failed:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
