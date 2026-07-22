const express = require("express");
const cors = require("cors");

const { searchPlayer, scrapeInjuryHistory, scrapeNextFixture } = require("./scraper");
const { buildHeatMap } = require("./bodyMap");
const { computeRiskScore, predictNextMatchRisk } = require("./riskEngine");
const { marcoReus } = require("./seedData");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Simple in-memory cache so repeated requests don't hammer the source site.
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { time: Date.now(), value });
}

/**
 * GET /api/players/marco-reus
 * Built-in demo player — always available even with no network access,
 * so the POC works out of the box.
 */
app.get("/api/players/marco-reus", (req, res) => {
  res.json(analyzePlayer(marcoReus.name, marcoReus.injuries, {
    dateOfBirth: marcoReus.dateOfBirth,
    sourceUrl: marcoReus.sourceUrl,
    live: false
  }));
});

/**
 * GET /api/players/search?name=...
 * Live path: scrapes the source site. Falls back to a clear error (not fake
 * data) if scraping fails, so the frontend can tell the user what happened.
 */
app.get("/api/players/search", async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: "Missing ?name= query param" });

  const cacheKey = `search:${name.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const profileUrl = await searchPlayer(name);
    const { name: scrapedName, injuries } = await scrapeInjuryHistory(profileUrl);

    if (injuries.length === 0) {
      return res.status(502).json({
        error: "Player page found but no injuries could be parsed. The site layout may have changed — see server/src/scraper.js for selectors to fix.",
        profileUrl
      });
    }

    const nextMatchDate = await scrapeNextFixture(profileUrl);
    const result = analyzePlayer(scrapedName || name, injuries, { sourceUrl: profileUrl, live: true, nextMatchDate });
    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(502).json({
      error: `Live lookup failed: ${err.message}. Try the demo player, or check network/robots access.`,
    });
  }
});

function analyzePlayer(name, injuries, { dateOfBirth, sourceUrl, live, nextMatchDate } = {}) {
  const heatMap = buildHeatMap(injuries);
  const riskScore = computeRiskScore(injuries, heatMap);
  const prediction = predictNextMatchRisk(riskScore, injuries, { dateOfBirth, nextMatchDate });

  return {
    name,
    dateOfBirth: dateOfBirth || null,
    sourceUrl: sourceUrl || null,
    live: Boolean(live),
    injuryCount: injuries.length,
    injuries: [...injuries].sort((a, b) => new Date(b.from) - new Date(a.from)),
    heatMap,
    riskScore,
    prediction,
    nextMatchDate: nextMatchDate || null
  };
}

app.listen(PORT, () => {
  console.log(`Injury analysis API running on http://localhost:${PORT}`);
});
