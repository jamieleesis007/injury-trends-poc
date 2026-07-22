// Suggestion list for the nationality refinement field. Not exhaustive, and
// intentionally not a strict enum: the search backend does a loose
// substring match rather than requiring an exact value, so a nationality
// missing from this list can still be typed in by hand. Includes the UK
// home nations separately since that's how football nationality is
// generally reported (distinct from broader "United Kingdom").
export const NATIONALITIES = [
  "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria",
  "Belgium", "Bosnia and Herzegovina", "Brazil", "Bulgaria",
  "Cameroon", "Canada", "Chile", "China", "Colombia", "Costa Rica", "Croatia",
  "Czech Republic",
  "Denmark", "DR Congo",
  "Ecuador", "Egypt", "England",
  "Finland", "France",
  "Gabon", "Georgia", "Germany", "Ghana", "Greece", "Guinea",
  "Honduras", "Hungary",
  "Iceland", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan",
  "Kenya", "Kosovo",
  "Mali", "Mexico", "Montenegro", "Morocco",
  "Netherlands", "New Zealand", "Nigeria", "North Macedonia",
  "Northern Ireland", "Norway",
  "Panama", "Paraguay", "Peru", "Poland", "Portugal",
  "Qatar",
  "Republic of Ireland", "Romania", "Russia",
  "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Slovakia", "Slovenia",
  "South Africa", "South Korea", "Spain", "Sweden", "Switzerland",
  "Tunisia", "Turkey",
  "Ukraine", "Uruguay", "USA",
  "Venezuela", "Wales",
  "Zimbabwe"
];
