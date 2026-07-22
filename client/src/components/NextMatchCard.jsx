import React from "react";

const TIER_CLASS = {
  Low: "tier-low",
  Moderate: "tier-moderate",
  High: "tier-high"
};

export default function NextMatchCard({ prediction, nextMatchDate }) {
  return (
    <div>
      <div>
        <span className="prediction-pct">{prediction.probabilityPct}%</span>
        <span className={`tier-badge ${TIER_CLASS[prediction.tier]}`}>{prediction.tier} risk</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
        Estimated likelihood of an injury occurring in or around the player's
        next scheduled competitive match
        {nextMatchDate ? ` (${new Date(nextMatchDate).toLocaleDateString()})` : ""}.
      </p>

      {prediction.notes.length > 0 ? (
        <ul className="notes-list">
          {prediction.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : (
        <p className="no-notes">No elevated-risk factors detected beyond baseline history.</p>
      )}
    </div>
  );
}
