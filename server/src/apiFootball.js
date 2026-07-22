const axios = require("axios");

// Licensed structured data source (api-football.com), preferred over the
// Soccerway scraper when an API key is configured — see index.js for the
// fallback order.
//
// The key is read from process.env only and never sent to the client; the
// frontend talks exclusively to our own /api/* routes.
//
// NOTE: field names below (birth.date, sidelined type/start/end) follow
// API-Football's v3 documentation but haven't been verified against a live
// response from this environment (no outbound network access to
// api-sports.io from here). If real responses don't match, adjust the
// mapping in fetchInjuryHistory()/searchPlayerProfile() accordingly.

const BASE_URL = "https://v3.football.api-sports.io";

function client() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY is not set");
  return axios.create({
    baseURL: BASE_URL,
    headers: { "x-apisports-key": apiKey },
    timeout: 10000
  });
}

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents so "Gómez" matches "gomez"
    .trim();
}

// Common English nickname -> formal first name(s). Not exhaustive or
// multilingual - covers enough Anglo names that show up often in English &
// Scottish football. A nickname like "Joe" for "Joseph" can't be found by
// prefix/fuzzy string matching alone since the spellings genuinely diverge,
// so this is a plain lookup table rather than an algorithm.
const NICKNAMES = {
  joe: ["joseph"], joey: ["joseph"],
  mike: ["michael"], mick: ["michael"], mickey: ["michael"],
  alex: ["alexander", "alexandre", "alessandro"],
  nick: ["nicholas", "nicolas"],
  rob: ["robert"], bob: ["robert"], bobby: ["robert"],
  will: ["william"], bill: ["william"], billy: ["william"],
  tom: ["thomas"], tommy: ["thomas"],
  dan: ["daniel"], danny: ["daniel"],
  matt: ["matthew"],
  chris: ["christopher", "christian"],
  jim: ["james"], jimmy: ["james"],
  jack: ["john"],
  ben: ["benjamin"],
  sam: ["samuel"], sammy: ["samuel"],
  andy: ["andrew"],
  tony: ["anthony"],
  ed: ["edward"], eddie: ["edward"], ted: ["edward"],
  fred: ["frederick"], freddie: ["frederick", "alfred"],
  alfie: ["alfred"],
  charlie: ["charles"],
  harry: ["harold", "henry"],
  frank: ["francis", "franklin"],
  steve: ["stephen", "steven"],
  phil: ["philip", "phillip"],
  greg: ["gregory"],
  dave: ["david"], davey: ["david"],
  ken: ["kenneth"], kenny: ["kenneth"],
  ron: ["ronald"], ronnie: ["ronald"],
  don: ["donald"],
  pat: ["patrick"],
  vince: ["vincent"],
  zack: ["zachary"], zach: ["zachary"]
};

function tokensMatch(a, b) {
  if (a === b) return true;
  return (NICKNAMES[a] || []).includes(b) || (NICKNAMES[b] || []).includes(a);
}

// Ranks a candidate by how many of the searched name's tokens it matches -
// exact/nickname token match scores higher than a partial/prefix match.
// Needed because API-Football's /players/profiles search has no relevance
// ranking of its own, so the top result is often not the well-known player
// being searched for (there are many footballers worldwide who share
// common names).
function scoreCandidate(queryTokens, candidate) {
  const candidateName = normalize(candidate.name || `${candidate.firstname} ${candidate.lastname}`);
  const candidateTokens = candidateName.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const token of queryTokens) {
    if (candidateTokens.some((ct) => tokensMatch(ct, token))) score += 2;
    else if (candidateTokens.some((ct) => ct.startsWith(token) || token.startsWith(ct))) score += 1;
  }
  return score;
}

async function fetchProfileCandidates(search) {
  const { data } = await client().get("/players/profiles", { params: { search } });
  // TEMPORARY DEBUG LOGGING — remove once matching is confirmed reliable.
  // Prints to the server terminal only; never sent to the browser.
  console.log(`[API-Football] /players/profiles raw response for search="${search}":`, JSON.stringify(data, null, 2));
  return (data?.response || []).map((r) => r.player).filter(Boolean);
}

/**
 * Search API-Football for a player profile by name, picking the
 * best-matching candidate rather than assuming the first result is correct.
 *
 * Always searches by surname alone (the last word typed) rather than the
 * full name: API-Football's search appears to require every search term to
 * match, so a combined "first last" query both (a) misses players whose
 * registered first name differs from a nickname the user typed, and (b)
 * can come back completely empty for names it should easily find. Casting
 * a wider net on the surname and ranking candidates locally, with nickname
 * awareness, fixes both.
 */
async function searchPlayerProfile(name) {
  const queryTokens = normalize(name).split(/\s+/).filter(Boolean);
  const surname = queryTokens[queryTokens.length - 1];
  if (!surname) throw new Error(`No player found on API-Football for "${name}"`);

  const candidates = await fetchProfileCandidates(surname);
  if (candidates.length === 0) {
    throw new Error(`No player found on API-Football for "${name}"`);
  }

  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreCandidate(queryTokens, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return {
    id: best.id,
    name: best.name,
    dateOfBirth: best.birth?.date || null
  };
}

/**
 * Full injury/sideline history for a player id, normalized to the same
 * { from, until, type } shape the scraper and seed data use.
 */
async function fetchInjuryHistory(playerId) {
  const { data } = await client().get("/sidelined", { params: { player: playerId } });
  // TEMPORARY DEBUG LOGGING — see note above.
  console.log(`[API-Football] /sidelined raw response for player ${playerId}:`, JSON.stringify(data, null, 2));
  const rows = data?.response || [];
  return rows
    .filter((row) => row.start)
    .map((row) => ({
      from: row.start,
      until: row.end && row.end !== "Unknown" ? row.end : null,
      type: row.type || "Injury"
    }));
}

module.exports = { searchPlayerProfile, fetchInjuryHistory };
