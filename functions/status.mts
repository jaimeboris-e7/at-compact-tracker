// Public read endpoint. Returns the latest normalized compact-status JSON
// from Netlify Blobs. Falls back to bundled sample data if no refresh has
// run yet (e.g. right after first deploy, before LEGISCAN_API_KEY is set
// or before the first scheduled run has fired).

import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CORS_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=300",
};

export default async (req: Request) => {
  try {
    const store = getStore({ name: "at-compact-data", consistency: "strong" });
    const data = await store.get("latest.json", { type: "json" });

    if (data) {
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }
  } catch (err) {
    console.error("Could not read from Blobs store, falling back to sample data:", err);
  }

  // Fallback: bundled sample data shipped in the repo.
  try {
    const samplePath = fileURLToPath(
      new URL("../../public/data/sample-status.json", import.meta.url)
    );
    const sample = await readFile(samplePath, "utf-8");
    const parsed = JSON.parse(sample);
    parsed.isSampleData = true;
    return new Response(JSON.stringify(parsed), { headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: "No data available: " + err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
