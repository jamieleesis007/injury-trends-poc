const { daysBetween } = require("./bodyMap");

/**
 * Compute a 1-10 injury-proneness score from a player's injury history.
 *
 * Heuristic, not a validated clinical/statistical model — this is a POC.
 * Factors combined (each 0-1, then weighted):
 *  - frequency: injuries per year of the player's tracked career window
 *  - severity: average days out per injury (capped)
 *  - recency: how recently the most recent injury occurred
 *  - recurrence: how concentrated injuries are in a small number of regions
 *    (repeated hits to the same region signal a chronic/overuse pattern)
 */
function computeRiskScore(injuries, heatMap, { now = new Date() } = {}) {
  if (injuries.length === 0) {
    return { score: 1, breakdown: { frequency: 0, severity: 0, recency: 0, recurrence: 0 } };
  }

  const sorted = [...injuries].sort((a, b) => new Date(a.from) - new Date(b.from));
  const firstDate = new Date(sorted[0].from);
  const careerYears = Math.max(1, (now - firstDate) / (1000 * 60 * 60 * 24 * 365));

  // --- Frequency: injuries per year, normalized against a busy-but-plausible ceiling of 6/yr
  const perYear = injuries.length / careerYears;
  const frequency = Math.min(1, perYear / 6);

  // --- Severity: average days out per injury, normalized against a 60-day ceiling
  const totalDays = injuries.reduce((sum, inj) => sum + daysBetween(inj.from, inj.until), 0);
  const avgDays = totalDays / injuries.length;
  const severity = Math.min(1, avgDays / 60);

  // --- Recency: days since most recent injury onset, normalized (0 = >2yrs ago, 1 = today)
  const mostRecent = sorted[sorted.length - 1];
  const daysSinceLast = Math.max(0, (now - new Date(mostRecent.from)) / (1000 * 60 * 60 * 24));
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

  const weights = { frequency: 0.35, severity: 0.2, recency: 0.2, recurrence: 0.25 };
  const composite =
    frequency * weights.frequency +
    severity * weights.severity +
    recency * weights.recency +
    recurrence * weights.recurrence;

  const score = Math.round(1 + composite * 9); // map 0-1 -> 1-10

  return {
    score: Math.min(10, Math.max(1, score)),
    breakdown: {
      frequency: Number(frequency.toFixed(2)),
      severity: Number(severity.toFixed(2)),
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
 *  - age adjustment (very small; injury risk trends up with age in the data itself,
 *    which frequency/recency already partly capture, so this is a light nudge only)
 */
function predictNextMatchRisk(riskScore, injuries, { now = new Date(), nextMatchDate, dateOfBirth } = {}) {
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

  // Light age nudge
  let ageNote = null;
  if (dateOfBirth) {
    const age = (now - new Date(dateOfBirth)) / (1000 * 60 * 60 * 24 * 365);
    if (age >= 32) {
      base += 0.05;
      ageNote = `Player age ${Math.floor(age)} — injury incidence typically rises in the 30s`;
    }
  }

  const probability = Math.min(0.92, Math.max(0.03, base));

  let tier = "Low";
  if (probability >= 0.65) tier = "High";
  else if (probability >= 0.35) tier = "Moderate";

  return {
    probabilityPct: Math.round(probability * 100),
    tier,
    notes: [returnWindowNote, congestionNote, ageNote].filter(Boolean)
  };
}

module.exports = { computeRiskScore, predictNextMatchRisk };
