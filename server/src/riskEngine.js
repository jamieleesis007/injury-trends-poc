const { daysBetween } = require("./bodyMap");

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365;

// Used to estimate career length from date of birth (see estimateCareerDays)
// - not meant to be precise, just a reasonable floor for "years as a
// professional" so a long, mostly-healthy career doesn't get judged on the
// same footing as a short one.
const ESTIMATED_DEBUT_AGE = 18;

// Injury `type` is free text from the source data ("Thigh Injury", "Knock",
// "ACL Rupture", ...). This buckets it into a severity tier so that, e.g., a
// torn ACL counts for more than a generic knock of the same duration - two
// players who each lost 30 days can represent very different underlying
// risk depending on what actually happened.
const MAJOR_INJURY_KEYWORDS = ["acl", "cruciate", "achilles", "rupture", "fracture", "break", "surgery", "dislocation", "tendon", "torn"];
const MINOR_INJURY_KEYWORDS = ["knock", "illness", "flu", "virus", "cold", "covid", "sickness", "suspension", "rest"];
const SEVERITY_MULTIPLIER = { major: 1.6, moderate: 1, minor: 0.35 };

function classifySeverity(typeText) {
  const t = (typeText || "").toLowerCase();
  if (MAJOR_INJURY_KEYWORDS.some((k) => t.includes(k))) return "major";
  if (MINOR_INJURY_KEYWORDS.some((k) => t.includes(k))) return "minor";
  return "moderate";
}

// A career-length denominator, not just "time since their first recorded
// injury" - that anchor understates career length for exactly the players
// this fix is for (a long, mostly injury-free career whose earliest injury
// record might be recent), which would unfairly inflate their risk. When
// date of birth is known, estimate seasons played from age instead; only
// fall back to the injury-anchored estimate when it isn't available.
function estimateCareerDays(injuries, dateOfBirth, now) {
  if (dateOfBirth) {
    const ageYears = (now - new Date(dateOfBirth)) / MS_PER_YEAR;
    if (ageYears > ESTIMATED_DEBUT_AGE) {
      return (ageYears - ESTIMATED_DEBUT_AGE) * 365;
    }
  }
  const sorted = [...injuries].sort((a, b) => new Date(a.from) - new Date(b.from));
  const firstDate = new Date(sorted[0].from);
  return Math.max(365, (now - firstDate) / MS_PER_DAY);
}

/**
 * Compute a 1-10 injury-proneness score from a player's injury history.
 *
 * Heuristic, not a validated clinical/statistical model — this is a POC.
 * Factors combined (each 0-1, then weighted):
 *  - frequency: raw injury count per year - how often they pick up knocks,
 *    regardless of how long each one kept them out
 *  - burden: severity-weighted days out as a *share of career length*. This
 *    is the key factor for telling apart "lots of games, few real injuries"
 *    from "short career, badly hit" - the same total days out matters far
 *    less spread over 15 seasons than over 2. See estimateCareerDays() and
 *    classifySeverity() above.
 *  - recency: how recently the most recent injury occurred
 *  - recurrence: how concentrated injuries are in a small number of regions
 *    (repeated hits to the same region signal a chronic/overuse pattern)
 */
function computeRiskScore(injuries, heatMap, { now = new Date(), dateOfBirth } = {}) {
  if (injuries.length === 0) {
    return { score: 1, breakdown: { frequency: 0, burden: 0, recency: 0, recurrence: 0 } };
  }

  const sorted = [...injuries].sort((a, b) => new Date(a.from) - new Date(b.from));
  const careerDays = estimateCareerDays(injuries, dateOfBirth, now);
  const careerYears = careerDays / 365;

  // --- Frequency: injuries per year, normalized against a busy-but-plausible ceiling of 6/yr
  const perYear = injuries.length / careerYears;
  const frequency = Math.min(1, perYear / 6);

  // --- Burden: severity-weighted days out, as a share of estimated career
  // length so far, scaled against a 15%-of-career reference point (losing
  // more than that to injury is a strong signal on its own). Uses a smooth
  // saturating curve rather than a hard cap: real players can blow well past
  // this reference (a 30%+ share isn't rare for a genuinely injury-hit
  // career), and a hard `Math.min(1, share/ceiling)` would flatten all of
  // them to the same maxed-out 1.0, making them indistinguishable from each
  // other even though their actual burden differs a lot.
  const weightedDaysOut = injuries.reduce((sum, inj) => {
    const days = daysBetween(inj.from, inj.until);
    return sum + days * SEVERITY_MULTIPLIER[classifySeverity(inj.type)];
  }, 0);
  const burdenShare = weightedDaysOut / careerDays;
  const burden = 1 - Math.exp(-burdenShare / 0.15);

  // --- Recency: days since most recent injury onset, normalized (0 = >2yrs ago, 1 = today)
  const mostRecent = sorted[sorted.length - 1];
  const daysSinceLast = Math.max(0, (now - new Date(mostRecent.from)) / MS_PER_DAY);
  const recency = Math.max(0, 1 - daysSinceLast / 730);

  // --- Recurrence: concentration of injuries in top regions (Herfindahl-style)
  const regionCounts = Object.values(heatMap.regions).map((r) => r.count);
  const totalClassified = regionCounts.reduce((a, b) => a + b, 0);
  let recurrence = 0;
  if (totalClassified > 0) {
    const shares = regionCounts.map((c) => c / totalClassified);
    const herfindahl = shares.reduce((sum, s) => sum + s * s, 0); // 1/n (spread) .. 1 (all in one region)
    recurrence = herfindahl;
  }

  const weights = { frequency: 0.15, burden: 0.4, recency: 0.2, recurrence: 0.25 };
  const composite =
    frequency * weights.frequency +
    burden * weights.burden +
    recency * weights.recency +
    recurrence * weights.recurrence;

  // Keep one decimal place rather than rounding to a whole number - two
  // players can have meaningfully different underlying risk (e.g. 5.8 vs
  // 6.3) that a whole-number score would hide by rounding both to "6",
  // making them look identical when they aren't. That lost precision also
  // used to feed directly into predictNextMatchRisk's base rate below.
  const score = Number((1 + composite * 9).toFixed(1)); // map 0-1 -> 1-10

  return {
    score: Math.min(10, Math.max(1, score)),
    breakdown: {
      frequency: Number(frequency.toFixed(2)),
      burden: Number(burden.toFixed(2)),
      recency: Number(recency.toFixed(2)),
      recurrence: Number(recurrence.toFixed(2))
    }
  };
}

/**
 * Predict likelihood (%) of injury in the next scheduled competitive match.
 *
 * Combines:
 *  - base risk score
 *  - "return window" effect: elevated re-injury risk in the ~30 days after
 *    coming back from a layoff (well-documented pattern in sports medicine)
 *  - days until next match (short turnaround / congestion raises risk slightly)
 *
 * There's deliberately no separate age adjustment here: age is already
 * reflected fairly in the risk score's career-length denominator (see
 * estimateCareerDays above) - a long, mostly healthy career already scores
 * low there. A flat "older = add risk" bonus on top of that would
 * double-count age and isn't justified by anything about the specific
 * player; it was previously the reason a fit veteran with a lower
 * underlying risk score could still show a higher predicted percentage
 * than a younger player with a worse injury record.
 */
function predictNextMatchRisk(riskScore, injuries, { now = new Date(), nextMatchDate } = {}) {
  const sorted = [...injuries].sort((a, b) => new Date(a.from) - new Date(b.from));
  const mostRecent = sorted[sorted.length - 1];

  let base = riskScore.score / 10; // 0.1 - 1.0

  // Return-from-injury window effect
  let returnWindowNote = null;
  if (mostRecent) {
    const returnDate = mostRecent.until ? new Date(mostRecent.until) : null;
    if (returnDate) {
      const daysSinceReturn = (now - returnDate) / (1000 * 60 * 60 * 24);
      if (daysSinceReturn >= 0 && daysSinceReturn <= 30) {
        base += 0.12 * (1 - daysSinceReturn / 30); // fades out over 30 days
        returnWindowNote = `Returned from injury ${Math.round(daysSinceReturn)} day(s) ago — elevated re-injury window`;
      }
    }
  }

  // Fixture congestion effect
  let congestionNote = null;
  if (nextMatchDate) {
    const daysToMatch = (new Date(nextMatchDate) - now) / (1000 * 60 * 60 * 24);
    if (daysToMatch >= 0 && daysToMatch <= 3) {
      base += 0.05;
      congestionNote = "Short turnaround to next fixture (\u2264 3 days)";
    }
  }

  const probability = Math.min(0.92, Math.max(0.03, base));

  let tier = "Low";
  if (probability >= 0.65) tier = "High";
  else if (probability >= 0.35) tier = "Moderate";

  return {
    probabilityPct: Math.round(probability * 100),
    tier,
    notes: [returnWindowNote, congestionNote].filter(Boolean)
  };
}

module.exports = { computeRiskScore, predictNextMatchRisk };
