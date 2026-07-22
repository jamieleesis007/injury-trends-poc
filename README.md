# Injury Trends — Footballer Injury Risk Analysis (POC)

A proof-of-concept tool that analyses a footballer's injury history, scores
their injury-proneness from 1–10, visualises a body heatmap of at-risk areas,
and predicts the likelihood of injury around their next competitive match.

This was built as a two-process local app:

- **`server/`** — Node/Express API. Scrapes public injury data, runs the
  risk-scoring and prediction logic, and serves JSON to the frontend.
- **`client/`** — React (Vite) dashboard. Fetches from the API and renders
  the risk gauge, body heatmap, prediction card, and injury timeline.

---

## 1. Data source & why Soccerway, not Transfermarkt

You originally asked for Transfermarkt. I checked its `robots.txt` directly
and it **disallows automated access**, and the site also runs active bot
detection — so a scraper built against it would be fragile and against the
site's terms. Soccerway publishes very similar structured injury-history
data and its `robots.txt` allows crawling, so the live scraper
(`server/src/scraper.js`) targets that instead.

**Important caveat on the scraper:** this project was built in a sandboxed
environment with no live network access, so the CSS selectors in
`scraper.js` were written from the page's rendered content rather than
verified against raw HTML. Before relying on it:

1. Run it against a real player and confirm the table-row parsing still
   matches the live markup (`npm run dev` in `server/`, then hit
   `/api/players/search?name=...`).
2. If the site's markup has changed, adjust the selectors in
   `scrapeInjuryHistory()` and `scrapeNextFixture()`.
3. Add request throttling/caching before any heavier use — a basic 30-minute
   in-memory cache is already included, but it's not a substitute for rate
   limiting on a shared deployment.
4. Re-check `robots.txt` and Terms of Use periodically.

A **built-in demo player (Marco Reus)** is always available via
`/api/players/marco-reus`, using a seeded dataset gathered during
development, so the app works end-to-end even without a live scrape.

## 2. How the analysis works

- **Body mapping** (`bodyMap.js`): injury-type text is matched to one of 12
  anatomical regions (head, shoulder, chest, back, core, hip, groin, thigh,
  knee, calf, ankle, foot). Entries like "Illness" or "Knock" aren't
  musculoskeletal and are excluded from the heatmap.
  - **Laterality (left/right) is not available** in public injury listings,
    so the heatmap shows regions, not sides — the example in your brief
    ("right hamstring") isn't achievable from this data source as-is. Paired
    zones (shoulders, thighs, knees, calves, feet) are shown with mirrored
    intensity. If you find a data source with laterality, extend
    `REGION_KEYWORDS` and split the SVG zones in `BodyHeatmap.jsx`.
- **Risk score 1–10** (`riskEngine.js`): a weighted heuristic combining
  injury frequency, average severity (days out), recency, and how
  concentrated injuries are in a small number of regions (recurrence). This
  is **not a validated clinical or statistical model** — it's a reasonable,
  explainable POC heuristic. The breakdown bars in the UI show each factor's
  contribution.
- **Next-match prediction** (`riskEngine.js`): adjusts the base risk score
  for a "return-from-injury" window (elevated re-injury risk in the ~30 days
  after a lay-off), fixture congestion if a next-match date is known, and a
  small age nudge. Output is a probability percentage and Low/Moderate/High
  tier, with the contributing factors listed.

## 3. Running it

Requires Node.js 18+ and internet access (for `npm install` and for the live
scraper to reach soccerway.com).

```bash
# Terminal 1 — API
cd server
npm install
npm start          # http://localhost:4000

# Terminal 2 — UI
cd client
npm install
npm run dev         # http://localhost:5173
```

Open `http://localhost:5173`. It loads the Marco Reus demo automatically;
use the search box to try a live lookup for another player.

## 4. Known limitations (it's a POC)

- No laterality (left/right) in the underlying data — see above.
- The live scraper's selectors are unverified against real markup (see §1).
- Fixture/next-match scraping is best-effort; if it fails, the prediction
  still runs using only history-based factors (no congestion note).
- Risk scoring weights are illustrative, not fitted to real outcomes — a
  genuine version of this would need labelled data (did the player actually
  get injured in match N+1) to validate or train against.
- No persistence/database — every request re-scrapes or re-reads seed data.
- No authentication, rate limiting is minimal (basic in-memory cache only).

## 5. Natural next steps

- Swap the heuristic risk model for one fitted against historical outcomes.
- Add a proper data pipeline (scheduled scrape + storage) instead of
  scrape-on-request.
- Source fixture/schedule data from a dedicated football data API for more
  reliable "next match" info.
- Add multi-player comparison views.
