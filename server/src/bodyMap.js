// Maps injury-type strings (as found on public injury listings) to a fixed
// set of anatomical regions, then computes a 0-1 heat intensity per region
// based on frequency, total days out, and recency.
//
// NOTE ON LATERALITY: public injury listings almost never specify left vs
// right, so this POC maps to body regions, not sides. If a future data
// source provides laterality, extend REGION_KEYWORDS with left/right
// variants and split the SVG regions accordingly.

const REGION_KEYWORDS = [
  { region: "head", keywords: ["head", "concussion", "facial", "nose", "eye"] },
  { region: "shoulder", keywords: ["shoulder", "collarbone", "clavicle"] },
  { region: "back", keywords: ["back", "spine", "vertebra", "disc"] },
  { region: "chest", keywords: ["chest", "rib"] },
  { region: "core", keywords: ["abdominal", "abdomen", "core"] },
  { region: "hip", keywords: ["hip", "pelvis"] },
  { region: "groin", keywords: ["groin", "adductor"] },
  { region: "thigh", keywords: ["thigh", "hamstring", "quad", "muscle"] },
  { region: "knee", keywords: ["knee", "meniscus", "acl", "mcl", "cruciate", "patella"] },
  { region: "calf", keywords: ["calf", "shin"] },
  { region: "ankle", keywords: ["ankle"] },
  { region: "foot", keywords: ["foot", "toe", "metatarsal", "heel", "achilles"] }
];

const NON_MUSCULOSKELETAL = ["illness", "knock", "convalescence", "injury", "suspension"];

function classifyInjury(typeText) {
  const t = typeText.toLowerCase();
  for (const entry of REGION_KEYWORDS) {
    if (entry.keywords.some((kw) => t.includes(kw))) return entry.region;
  }
  return null; // unclassified (illness, generic "Injury", knock, etc.)
}

function daysBetween(fromISO, untilISO) {
  const from = new Date(fromISO);
  const until = untilISO ? new Date(untilISO) : new Date(); // ongoing
  const ms = until - from;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Build a per-region heat map from a list of { from, until, type } injuries.
 * Returns { regions: { [region]: { intensity: 0-1, count, totalDays, injuries: [...] } }, unclassifiedCount }
 */
function buildHeatMap(injuries, { now = new Date() } = {}) {
  const regionStats = {};
  let unclassifiedCount = 0;

  for (const injury of injuries) {
    const region = classifyInjury(injury.type);
    if (!region) {
      unclassifiedCount += 1;
      continue;
    }
    const days = daysBetween(injury.from, injury.until);
    const ageYears = (now - new Date(injury.from)) / (1000 * 60 * 60 * 24 * 365);
    // Recency weight: full weight inside last year, decaying over 5 years, floor at 0.15
    const recencyWeight = Math.max(0.15, 1 - ageYears / 5);

    if (!regionStats[region]) {
      regionStats[region] = { count: 0, totalDays: 0, weightedScore: 0, injuries: [] };
    }
    regionStats[region].count += 1;
    regionStats[region].totalDays += days;
    regionStats[region].weightedScore += recencyWeight * (1 + Math.log10(days + 1));
    regionStats[region].injuries.push({ ...injury, days });
  }

  const maxScore = Math.max(0, ...Object.values(regionStats).map((r) => r.weightedScore));
  const regions = {};
  for (const [region, stats] of Object.entries(regionStats)) {
    regions[region] = {
      intensity: maxScore > 0 ? Number((stats.weightedScore / maxScore).toFixed(3)) : 0,
      count: stats.count,
      totalDays: stats.totalDays,
      injuries: stats.injuries.sort((a, b) => new Date(b.from) - new Date(a.from))
    };
  }

  return { regions, unclassifiedCount };
}

module.exports = { classifyInjury, buildHeatMap, daysBetween, NON_MUSCULOSKELETAL };
