import React, { useState } from "react";

// Maps the data-model regions (from server/src/bodyMap.js) onto the visual
// zones drawn in the SVG pictogram below. Some visual zones combine more
// than one data region (e.g. hip + groin) because a single front-facing
// pictogram can't usefully separate them.
const ZONE_MAP = {
  head: { label: "Head", dataRegions: ["head"] },
  shoulder_l: { label: "Shoulder", dataRegions: ["shoulder"] },
  shoulder_r: { label: "Shoulder", dataRegions: ["shoulder"] },
  torso_upper: { label: "Chest / Upper back", dataRegions: ["chest", "back"] },
  torso_lower: { label: "Core", dataRegions: ["core"] },
  hip: { label: "Hip / Groin", dataRegions: ["hip", "groin"] },
  thigh_l: { label: "Thigh", dataRegions: ["thigh"] },
  thigh_r: { label: "Thigh", dataRegions: ["thigh"] },
  knee_l: { label: "Knee", dataRegions: ["knee"] },
  knee_r: { label: "Knee", dataRegions: ["knee"] },
  calf_l: { label: "Calf", dataRegions: ["calf"] },
  calf_r: { label: "Calf", dataRegions: ["calf"] },
  foot_l: { label: "Ankle / Foot", dataRegions: ["ankle", "foot"] },
  foot_r: { label: "Ankle / Foot", dataRegions: ["ankle", "foot"] }
};

function zoneIntensity(regions, dataRegions) {
  let max = 0;
  let count = 0;
  let totalDays = 0;
  for (const key of dataRegions) {
    const r = regions[key];
    if (r) {
      max = Math.max(max, r.intensity);
      count += r.count;
      totalDays += r.totalDays;
    }
  }
  return { intensity: max, count, totalDays };
}

// Interpolates: no-data baseline (soft green) -> amber -> deep red
function intensityColor(intensity, hasData) {
  if (!hasData) return "#2C3A36"; // neutral, truly no data
  const stops = [
    { at: 0, color: [110, 199, 148] },   // light green — low concern
    { at: 0.5, color: [230, 176, 61] },  // amber — moderate
    { at: 1, color: [200, 45, 35] }      // deep red — high concern
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (intensity >= stops[i].at && intensity <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const t = (intensity - lo.at) / span;
  const rgb = lo.color.map((c, i) => Math.round(c + (hi.color[i] - c) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function BodyHeatmap({ heatMap }) {
  const [hovered, setHovered] = useState(null);
  const regions = heatMap?.regions || {};

  const zoneProps = (zoneKey) => {
    const zone = ZONE_MAP[zoneKey];
    const { intensity, count, totalDays } = zoneIntensity(regions, zone.dataRegions);
    const hasData = count > 0;
    return {
      fill: intensityColor(intensity, hasData),
      onMouseEnter: () =>
        setHovered(
          hasData
            ? `${zone.label} — ${count} injur${count === 1 ? "y" : "ies"}, ${totalDays} days out`
            : `${zone.label} — no recorded injuries`
        ),
      onMouseLeave: () => setHovered(null),
      style: { cursor: "pointer", transition: "fill 0.2s ease" },
      stroke: "#0D1214",
      strokeWidth: 1.5
    };
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div className="heatmap-legend">
          <span>LOW</span>
          <div className="legend-gradient" />
          <span>HIGH</span>
        </div>
      </div>

      <svg viewBox="0 0 200 420" width="100%" height="380" role="img" aria-label="Body injury heatmap">
        {/* head */}
        <circle cx="100" cy="28" r="20" {...zoneProps("head")} />
        {/* neck */}
        <rect x="92" y="46" width="16" height="12" fill="#2C3A36" stroke="#0D1214" strokeWidth="1.5" />
        {/* shoulders */}
        <circle cx="60" cy="72" r="14" {...zoneProps("shoulder_l")} />
        <circle cx="140" cy="72" r="14" {...zoneProps("shoulder_r")} />
        {/* upper arms (neutral, not modeled) */}
        <rect x="46" y="80" width="16" height="70" rx="8" fill="#1E2A27" stroke="#0D1214" strokeWidth="1.5" />
        <rect x="138" y="80" width="16" height="70" rx="8" fill="#1E2A27" stroke="#0D1214" strokeWidth="1.5" />
        {/* torso upper (chest/back) */}
        <rect x="68" y="58" width="64" height="66" rx="14" {...zoneProps("torso_upper")} />
        {/* torso lower (core) */}
        <rect x="72" y="122" width="56" height="46" rx="10" {...zoneProps("torso_lower")} />
        {/* hip/groin */}
        <rect x="70" y="166" width="60" height="30" rx="12" {...zoneProps("hip")} />
        {/* thighs */}
        <rect x="72" y="196" width="24" height="80" rx="10" {...zoneProps("thigh_l")} />
        <rect x="104" y="196" width="24" height="80" rx="10" {...zoneProps("thigh_r")} />
        {/* knees */}
        <circle cx="84" cy="284" r="12" {...zoneProps("knee_l")} />
        <circle cx="116" cy="284" r="12" {...zoneProps("knee_r")} />
        {/* calves */}
        <rect x="74" y="296" width="20" height="70" rx="9" {...zoneProps("calf_l")} />
        <rect x="106" y="296" width="20" height="70" rx="9" {...zoneProps("calf_r")} />
        {/* ankle/foot */}
        <ellipse cx="84" cy="378" rx="14" ry="9" {...zoneProps("foot_l")} />
        <ellipse cx="116" cy="378" rx="14" ry="9" {...zoneProps("foot_r")} />
      </svg>

      <div className="region-tooltip">{hovered || "\u00A0"}</div>

      <p className="heatmap-caption">
        Hover a region for detail. Source data doesn't specify left vs. right,
        so paired zones (shoulders, thighs, knees, calves, feet) mirror the
        same intensity. Arms are shown for anatomy only — not modeled.
      </p>
    </div>
  );
}
