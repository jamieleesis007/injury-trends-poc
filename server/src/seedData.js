// Seed dataset — gathered from publicly available injury-history listings.
// This acts as a fallback/cache when live scraping fails (rate limits, layout
// changes, network restrictions) and as demo data so the POC works out of the box.
// The live scraper (scraper.js) is the primary path and will overwrite this
// when it successfully reaches the source site.

const marcoReus = {
  slug: "marco-reus",
  name: "Marco Reus",
  position: "Midfielder",
  club: "Los Angeles Galaxy",
  dateOfBirth: "1989-05-31",
  sourceUrl: "https://www.soccerway.com/player/reus-marco/fonESekN/injury-history/",
  injuries: [
    { from: "2026-05-07", until: "2026-05-09", type: "Foot Injury" },
    { from: "2025-09-06", until: "2026-02-07", type: "Thigh Injury" },
    { from: "2025-05-30", until: "2025-06-13", type: "Thigh Injury" },
    { from: "2025-03-11", until: "2025-04-18", type: "Knee Injury" },
    { from: "2024-12-02", until: "2024-12-06", type: "Injury" },
    { from: "2024-09-23", until: "2024-10-19", type: "Thigh Injury" },
    { from: "2024-01-26", until: "2024-02-04", type: "Illness" },
    { from: "2024-01-17", until: "2024-01-19", type: "Illness" },
    { from: "2023-03-08", until: "2023-03-15", type: "Illness" },
    { from: "2023-01-14", until: "2023-01-28", type: "Illness" },
    { from: "2022-11-07", until: "2023-01-09", type: "Ankle Injury" },
    { from: "2022-10-17", until: "2022-11-04", type: "Ankle Injury" },
    { from: "2022-10-07", until: "2022-10-14", type: "Illness" },
    { from: "2022-09-18", until: "2022-10-06", type: "Ankle Injury" },
    { from: "2022-08-23", until: "2022-08-26", type: "Calf Injury" },
    { from: "2022-06-08", until: "2022-07-13", type: "Thigh Injury" },
    { from: "2022-03-09", until: "2022-03-24", type: "Illness" },
    { from: "2022-02-25", until: "2022-03-02", type: "Knock" },
    { from: "2021-12-19", until: "2022-01-07", type: "Knock" },
    { from: "2021-09-25", until: "2021-09-27", type: "Knee Injury" },
    { from: "2021-09-07", until: "2021-09-09", type: "Knee Injury" },
    { from: "2021-09-06", until: "2021-09-10", type: "Knee Injury" },
    { from: "2021-04-13", until: "2021-04-13", type: "Muscle Injury" },
    { from: "2021-03-14", until: "2021-04-01", type: "Muscle Injury" },
    { from: "2020-02-05", until: "2020-09-06", type: "Groin Injury" },
    { from: "2019-12-18", until: "2020-01-06", type: "Muscle Injury" },
    { from: "2019-11-10", until: "2019-11-21", type: "Ankle Injury" },
    { from: "2019-11-03", until: "2019-11-08", type: "Ankle Injury" },
    { from: "2019-10-27", until: "2019-11-01", type: "Muscle Injury" },
    { from: "2019-10-14", until: "2019-10-25", type: "Illness" },
    { from: "2019-02-06", until: "2019-02-28", type: "Thigh Injury" },
    { from: "2018-12-22", until: "2019-01-25", type: "Ankle Injury" },
    { from: "2018-12-09", until: "2018-12-14", type: "Thigh Injury" },
    { from: "2018-11-29", until: "2018-12-07", type: "Thigh Injury" },
    { from: "2018-10-07", until: "2018-10-19", type: "Knee Injury" },
    { from: "2018-04-30", until: "2018-05-04", type: "Injury" },
    { from: "2018-03-16", until: "2018-04-07", type: "Thigh Injury" },
    { from: "2017-05-29", until: "2018-01-05", type: "Knee Injury" },
    { from: "2017-03-06", until: "2017-04-14", type: "Thigh Injury" },
    { from: "2017-02-09", until: "2017-02-10", type: "Hip Injury" },
    { from: "2016-10-14", until: "2016-11-21", type: "Convalescence" },
    { from: "2016-08-14", until: "2016-10-13", type: "Groin Injury" },
    { from: "2016-07-04", until: "2016-08-12", type: "Groin Injury" }
  ]
};

module.exports = { marcoReus };
