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

/**
 * Search API-Football for a player profile by name.
 */
async function searchPlayerProfile(name) {
  const { data } = await client().get("/players/profiles", { params: { search: name } });
  const match = data?.response?.[0]?.player;
  if (!match) throw new Error(`No player found on API-Football for "${name}"`);
  return {
    id: match.id,
    name: match.name,
    dateOfBirth: match.birth?.date || null
  };
}

/**
 * Full injury/sideline history for a player id, normalized to the same
 * { from, until, type } shape the scraper and seed data use.
 */
async function fetchInjuryHistory(playerId) {
  const { data } = await client().get("/sidelined", { params: { player: playerId } });
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
