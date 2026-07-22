import React from "react";

const FACTOR_LABELS = {
  frequency: "Frequency",
  burden: "Career burden",
  recency: "Recency",
  recurrence: "Recurrence"
};

function scoreColor(score) {
  if (score <= 3) return "var(--green)";
  if (score <= 6) return "var(--amber)";
  return "var(--red)";
}

export default function RiskGauge({ riskScore }) {
  const color = scoreColor(riskScore.score);

  return (
    <div className="gauge-wrap">
      <div className="gauge-score" style={{ color }}>
        {riskScore.score}
        <span style={{ fontSize: 22, color: "var(--text-faint)" }}>/10</span>
      </div>
      <div className="gauge-label">Injury proneness</div>

      <div className="breakdown">
        {Object.entries(riskScore.breakdown).map(([key, value]) => (
          <div className="breakdown-row" key={key}>
            <span>{FACTOR_LABELS[key] || key}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
            </div>
            <span>{Math.round(value * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
