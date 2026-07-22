const axios = require("axios");
const cheerio = require("cheerio");

// IMPORTANT — read before relying on this in anything beyond a POC:
//
// This scraper targets soccerway.com, whose robots.txt allows automated
// access (verified at build time). Selectors below were built from the
// page's rendered text/structure since this project was built in a
// sandboxed environment without live network access to inspect raw HTML.
// Before depending on this for real use:
//   1. Run it against a live player page and confirm the selectors still
//      match (site markup changes over time).
//   2. Add request throttling / caching — do not hammer the site.
//   3. Re-check robots.txt periodically; sites change their policies.
//   4. Respect the site's Terms of Use for any non-personal use.
//
// If scraping fails for any reason, callers should fall back to seedData.js
// (see index.js) so the POC still functions end to end.

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; InjuryTrendsPOC/0.1; +https://example.local/poc)"
};

async function fetchHtml(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  return cheerio.load(res.data);
}

/**
 * Search Soccerway for a player by name, return best-guess profile URL.
 *
 * `filters.nationality`/`filters.club`/`filters.position` are appended to
 * the search text as a best-effort relevance nudge for common surnames —
 * Soccerway's search has no structured filter params we can target, and
 * this scraper always just takes the first result, so this is the only
 * lever available here. `filters.age` is omitted since a bare number in
 * free-text search is more likely to confuse results than help. If none of
 * this helps for a given query, the API-Football path (which does proper
 * candidate filtering) is tried first anyway - see index.js.
 */
async function searchPlayer(name, filters = {}) {
  const q = [name, filters.club, filters.nationality, filters.position].filter(Boolean).join(" ");
  const url = `https://www.soccerway.com/search/?q=${encodeURIComponent(q)}`;
  const $ = await fetchHtml(url);
  const link = $('a[href*="/player/"]').first().attr("href");
  if (!link) throw new Error(`No player found for "${name}"`);
  return link.startsWith("http") ? link : `https://www.soccerway.com${link}`;
}

/**
 * Scrape a player's injury history table.
 * Expects rows of the form: From | Until | Injury type
 */
async function scrapeInjuryHistory(playerProfileUrl) {
  const injuryUrl = playerProfileUrl.replace(/\/?$/, "/") + "injury-history/";
  const $ = await fetchHtml(injuryUrl);

  const injuries = [];
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, td) => $(td).text().trim())
      .get();
    if (cells.length >= 3) {
      const [fromRaw, untilRaw, type] = cells;
      const from = parseLooseDate(fromRaw);
      const until = parseLooseDate(untilRaw);
      if (from && type) {
        injuries.push({ from, until: until || null, type });
      }
    }
  });

  const name = $("h1").first().text().trim();

  return { name, injuries };
}

/**
 * Scrape a player's next scheduled competitive fixture from their club page.
 * Best-effort: falls back to null if the layout doesn't match, in which case
 * callers should let the user supply nextMatchDate manually.
 */
async function scrapeNextFixture(clubUrl) {
  try {
    const fixturesUrl = clubUrl.replace(/\/?$/, "/") + "fixtures/";
    const $ = await fetchHtml(fixturesUrl);
    const firstDateText = $("[class*=date]").first().text().trim();
    const parsed = parseLooseDate(firstDateText);
    return parsed || null;
  } catch (err) {
    return null;
  }
}

function parseLooseDate(text) {
  if (!text) return null;
  // Handles "Sep 06, 25" / "Sep 06, 2025" / "2025-09-06" style strings
  const cleaned = text.replace(/\s+/g, " ").trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    // Guard against 2-digit years parsing weirdly (JS handles "25" as 1925 in some engines)
    if (d.getFullYear() < 1980) d.setFullYear(d.getFullYear() + 100);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

module.exports = { searchPlayer, scrapeInjuryHistory, scrapeNextFixture };
