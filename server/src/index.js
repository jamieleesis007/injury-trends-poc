require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { searchPlayer, scrapeInjuryHistory, scrapeNextFixture } = require("./scraper");
const { searchPlayerProfile, fetchInjuryHistory } = require("./apiFootball");
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
    club: marcoReus.club,
    sourceUrl: marcoReus.sourceUrl,
    live: false
  }));
});

/**
 * GET /api/players/search?name=...&nationality=...&club=...
 * Live path: scrapes the source site. Falls back to a clear error (not fake
 * data) if scraping fails, so the frontend can tell the user what happened.
 *
 * `nationality` and `club` are optional refinement filters — common surnames
 * (e.g. "Joe Gomez") otherwise return many plausible candidates, so these
 * narrow the pool before we pick a "best" match. See searchPlayerProfile()
 * in apiFootball.js for how they're applied.
 */
app.get("/api/players/search", async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: "Missing ?name= query param" });

  const filters = {
    nationality: (req.query.nationality || "").trim() || undefined,
    club: (req.query.club || "").trim() || undefined
  };

  const cacheKey = `search:${name.toLowerCase()}:${(filters.nationality || "").toLowerCase()}:${(filters.club || "").toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Preferred path: API-Football (licensed, structured data). Falls through
  // to the Soccerway scraper below if no key is configured, the player
  // isn't found, or the request fails for any reason. `attempts` records
  // why each source was skipped/failed so a total failure is diagnosable
  // from the API response alone, not just server-side logs.
  const attempts = [];

  if (process.env.API_FOOTBALL_KEY) {
    try {
      const profile = await searchPlayerProfile(name, filters);
      const injuries = await fetchInjuryHistory(profile.id);
      if (injuries.length > 0) {
        const result = analyzePlayer(profile.name, injuries, {
          dateOfBirth: profile.dateOfBirth,
          nationality: profile.nationality,
          club: profile.club,
          sourceUrl: "https://www.api-football.com/",
          live: true
        });
        setCached(cacheKey, result);
        return res.json(result);
      }
      attempts.push("API-Football: player found but no sidelined/injury records returned");
    } catch (err) {
      attempts.push(`API-Football: ${err.message}`);
    }
  } else {
    attempts.push("API-Football: no API_FOOTBALL_KEY configured");
  }

  try {
    const profileUrl = await searchPlayer(name, filters);
    const { name: scrapedName, injuries } = await scrapeInjuryHistory(profileUrl);

    if (injuries.length === 0) {
      attempts.push("Soccerway: player page found but no injuries could be parsed (site layout may have changed — see server/src/scraper.js)");
      console.warn(`Live lookup failed for "${name}":\n${attempts.map((a) => `  - ${a}`).join("\n")}`);
      return res.status(502).json({ error: formatAttempts(attempts), profileUrl });
    }

    const nextMatchDate = await scrapeNextFixture(profileUrl);
    const result = analyzePlayer(scrapedName || name, injuries, { sourceUrl: profileUrl, live: true, nextMatchDate });
    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    attempts.push(`Soccerway: ${err.message}`);
    console.warn(`Live lookup failed for "${name}":\n${attempts.map((a) => `  - ${a}`).join("\n")}`);
    res.status(502).json({ error: formatAttempts(attempts) });
  }
});

function formatAttempts(attempts) {
  return `Live lookup failed for every source:\n${attempts.map((a) => `- ${a}`).join("\n")}\nTry the demo player, or check network/robots access.`;
}

function analyzePlayer(name, injuries, { dateOfBirth, nationality, club, sourceUrl, live, nextMatchDate } = {}) {
  const heatMap = buildHeatMap(injuries);
  const riskScore = computeRiskScore(injuries, heatMap);
  const prediction = predictNextMatchRisk(riskScore, injuries, { dateOfBirth, nextMatchDate });

  return {
    name,
    dateOfBirth: dateOfBirth || null,
    nationality: nationality || null,
    club: club || null,
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
