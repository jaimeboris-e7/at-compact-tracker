# Athletic Trainer Compact Tracker

A public tracker for Athletic Trainer Licensure Compact legislation across
all 50 states + DC. Shows a color-coded map, a sortable/filterable bill
table, and per-state detail (bill text link, sponsors, last action) — kept
current by a daily automated pull from the [LegiScan](https://legiscan.com)
API.

## How it's built

- **Frontend**: a single static `public/index.html` (no build step) — a US
  choropleth map (D3 + `us-atlas` topojson, loaded from CDN), a bill table,
  filters, and a detail panel. Reads from `/.netlify/functions/status`.
- **`netlify/functions/status.mts`**: public read endpoint. Serves the
  latest data from Netlify Blobs, falling back to the bundled
  `public/data/sample-status.json` snapshot if no refresh has run yet.
- **`netlify/functions/refresh-data.mts`**: a *scheduled function* (daily,
  see `netlify.toml`) that queries LegiScan for compact-related bills across
  every state, normalizes each into a status bucket, and writes the result
  to Netlify Blobs.
- **`netlify/functions/trigger-refresh.mts`**: the same refresh logic,
  callable over HTTP (`/api/refresh?secret=...`) for testing without waiting
  on the cron. Disabled unless `REFRESH_SECRET` is set.
- **`netlify/functions/lib/legiscan.mts`**: the shared fetch/classify/store
  logic both functions call.

Data flow: `refresh-data` (daily) → LegiScan API → Netlify Blobs →
`status` function → frontend.

## Setup

### 1. Get a LegiScan API key

Sign up for a free key at **https://legiscan.com/legiscan** (30,000
requests/month free tier — this app uses roughly 2 search calls + 1
`getBill` call per candidate bill on each daily run, well under quota for a
single-topic tracker).

### 2. Deploy to Netlify

Push this folder to a GitHub repo, then in Netlify: **Add new site → Import
an existing project** and point it at the repo. Netlify will pick up
`netlify.toml` automatically (build command: none needed — it's a static
`public/` folder + functions).

### 3. Set environment variables

In the Netlify site: **Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `LEGISCAN_API_KEY` | your key from step 1 |
| `REFRESH_SECRET` | optional — any random string, enables manual refresh |

### 4. Trigger the first refresh

The scheduled function runs daily at 09:00 UTC automatically, but the site
will show bundled sample data until it fires once. To populate real data
immediately after deploy, either:

- In the Netlify UI: **Functions → refresh-data → Run now**, or
- Visit `https://yoursite.netlify.app/api/refresh?secret=YOUR_REFRESH_SECRET`
  (only works if you set `REFRESH_SECRET`).

## Local development

```bash
npm install
netlify dev
```

`netlify dev` runs the functions locally and serves `public/`. Scheduled
functions don't auto-fire locally — use `netlify functions:invoke
refresh-data` to run one manually (needs `LEGISCAN_API_KEY` in a local
`.env`, see `.env.example`).

You can also just open `public/index.html` via any static file server
(`python3 -m http.server` from inside `public/`) — the frontend falls back
to `public/data/sample-status.json` automatically when the Netlify
functions aren't reachable, so you can iterate on the UI without Netlify at
all.

## How bill status is classified

LegiScan's numeric bill status plus its action history are mapped to one of:
`not_introduced`, `introduced`, `passed_one_chamber`, `passed_legislature`,
`enacted`, `vetoed`, `failed`. See `classifyStatus()` in
`netlify/functions/lib/legiscan.mts` — it's a heuristic (keyword/action-text
matching), so it will occasionally miscategorize an edge case. Every bill in
the UI links back to its LegiScan source page so you can verify.

## Search relevance filtering

LegiScan's full-text search can surface false positives (e.g. an unrelated
"athletic trainer scope of practice" bill, or a "compact" bill about
something else entirely). `fetchAndStoreCompactData()` filters candidates to
require both "athletic train…" and "compact" to appear in the bill's title
or description before counting it — this was validated during development
against real bills (it correctly excluded a Kansas school-recess bill and a
Minnesota scope-of-practice bill that both matched the raw search but aren't
compact legislation).

## Known limitations

- The map requires the CDN-hosted D3/topojson-client scripts and the
  `us-atlas` topojson file to load; if a viewer's network blocks those, the
  map panel shows a fallback message but the rest of the app (stats, table,
  filters, detail panel) keeps working from the same data.
- "Not introduced" means no matching bill was found in LegiScan for that
  state's current session — it doesn't confirm the state has no interest in
  joining the compact.
- This is independent, unofficial tracking software — not affiliated with
  the Athletic Trainer Compact Commission, NATA, LegiScan, or any state
  government. Verify anything you rely on against the linked primary source.
