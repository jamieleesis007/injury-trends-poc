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

// Loose containment match (either way) on normalized strings - used for the
// optional refinement filters, since we can't assume the user typed the
// exact string API-Football uses (e.g. "England" vs "english").
function looseMatch(a, b) {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Position is missing for a handful of candidates (youth/lower-tier
// profiles) - treat "unknown" as a pass rather than excluding them, since we
// can't confirm a mismatch either way.
function matchPosition(candidatePosition, targetPosition) {
  if (!candidatePosition) return true;
  return looseMatch(candidatePosition, targetPosition);
}

// Age tolerance either side of the requested age - API-Football's `age`
// field is frequently wrong/placeholder-y for lower-profile players (seen
// values of 0 or a birth year like 2025 standing in for age), and even
// correct ages drift by a year depending on when in the season they were
// computed, so this is intentionally forgiving rather than exact.
const AGE_TOLERANCE = 5;

function matchAge(candidateAge, targetAge) {
  if (!candidateAge || candidateAge <= 0) return true; // unknown/placeholder - don't exclude
  return Math.abs(candidateAge - targetAge) <= AGE_TOLERANCE;
}

/**
 * Current club is not part of the /players/profiles response, so it needs a
 * separate lookup. Best-effort only: returns null on any failure so a
 * missing/rate-limited call degrades to "no club info" rather than breaking
 * the search. The endpoint doesn't flag which team is "current", so we pick
 * the team associated with the highest season year as a proxy.
 */
async function fetchCurrentClub(playerId) {
  try {
    const { data } = await client().get("/players/teams", { params: { player: playerId } });
    const rows = data?.response || [];
    let latest = null;
    let latestSeason = -1;
    for (const row of rows) {
      const maxSeason = Math.max(0, ...(row.seasons || []));
      if (maxSeason > latestSeason) {
        latestSeason = maxSeason;
        latest = row.team;
      }
    }
    return latest ? { name: latest.name, logo: latest.logo || null } : null;
  } catch (err) {
    return null;
  }
}

// Club lookups cost an extra API call per candidate, so when a club filter
// is supplied we only run it against the top-N name-scored candidates
// rather than every "Gomez" in the database.
const MAX_CLUB_LOOKUPS = 15;

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
 *
 * `filters.nationality`, `filters.position`, `filters.age`, and
 * `filters.club` are optional refinements for common names (e.g. "Joe
 * Gomez") that would otherwise return dozens of plausible candidates. All
 * are applied as soft filters — if a filter eliminates every candidate
 * (e.g. a typo, or data API-Football doesn't have) we fall back to the
 * unfiltered set rather than erroring out.
 *
 * Nationality, position, and age are filtered for free off the same
 * /players/profiles response already fetched. Club is the expensive one —
 * it isn't in that response, so it needs a separate lookup per candidate —
 * which is why it's applied last, against a shortlist, and why the winning
 * candidate's club is only looked up when `filters.club` was actually used
 * (an unconditional lookup here would cost an extra API call on every
 * search, which burns through API-Football's rate limit fast).
 */
async function searchPlayerProfile(name, filters = {}) {
  const queryTokens = normalize(name).split(/\s+/).filter(Boolean);
  const surname = queryTokens[queryTokens.length - 1];
  if (!surname) throw new Error(`No player found on API-Football for "${name}"`);

  let candidates = await fetchProfileCandidates(surname);
  if (candidates.length === 0) {
    throw new Error(`No player found on API-Football for "${name}"`);
  }

  if (filters.nationality) {
    const byNationality = candidates.filter((c) => looseMatch(c.nationality, filters.nationality));
    if (byNationality.length > 0) candidates = byNationality;
  }

  if (filters.position) {
    const byPosition = candidates.filter((c) => matchPosition(c.position, filters.position));
    if (byPosition.length > 0) candidates = byPosition;
  }

  const targetAge = Number(filters.age);
  if (filters.age !== undefined && !Number.isNaN(targetAge)) {
    const byAge = candidates.filter((c) => matchAge(c.age, targetAge));
    if (byAge.length > 0) candidates = byAge;
  }

  candidates = [...candidates].sort(
    (a, b) => scoreCandidate(queryTokens, b) - scoreCandidate(queryTokens, a)
  );

  let clubById = new Map();
  if (filters.club) {
    const shortlist = candidates.slice(0, MAX_CLUB_LOOKUPS);
    const clubs = await Promise.all(shortlist.map((c) => fetchCurrentClub(c.id)));
    shortlist.forEach((c, i) => clubById.set(c.id, clubs[i]));

    const byClub = shortlist.filter((c) => looseMatch(clubById.get(c.id)?.name, filters.club));
    if (byClub.length > 0) candidates = byClub;
  }

  const best = candidates[0];
  const club = clubById.get(best.id) || null;

  return {
    id: best.id,
    name: best.name,
    dateOfBirth: best.birth?.date || null,
    nationality: best.nationality || null,
    position: best.position || null,
    age: best.age || null,
    number: best.number ?? null,
    club: club?.name || null,
    // Best-effort only - API-Football generates this URL from the player id
    // regardless of whether a real photo was ever uploaded for them, so it
    // 404s for a lot of lower-profile players. Treat as optional; the UI
    // must fall back gracefully rather than assume it always loads.
    photo: best.photo || null
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
