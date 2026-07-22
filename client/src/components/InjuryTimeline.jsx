import React from "react";

const DOT_COLOR = {
  head: "#E14B3E", shoulder: "#E14B3E", back: "#E14B3E", chest: "#E14B3E",
  core: "#F0B93D", hip: "#F0B93D", groin: "#F0B93D",
  thigh: "#3FD98A", knee: "#3FD98A", calf: "#3FD98A", ankle: "#3FD98A", foot: "#3FD98A"
};

function classify(type) {
  const t = type.toLowerCase();
  if (t.includes("thigh") || t.includes("hamstring") || t.includes("muscle")) return "thigh";
  if (t.includes("knee")) return "knee";
  if (t.includes("ankle")) return "ankle";
  if (t.includes("foot")) return "foot";
  if (t.includes("calf")) return "calf";
  if (t.includes("groin")) return "groin";
  if (t.includes("hip")) return "hip";
  if (t.includes("shoulder")) return "shoulder";
  if (t.includes("back")) return "back";
  if (t.includes("chest")) return "chest";
  return null;
}

function formatDate(iso) {
  if (!iso) return "Ongoing";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(from, until) {
  const end = until ? new Date(until) : new Date();
  return Math.max(1, Math.round((end - new Date(from)) / (1000 * 60 * 60 * 24)));
}

export default function InjuryTimeline({ injuries }) {
  return (
    <div className="timeline">
      {injuries.map((injury, i) => {
        const region = classify(injury.type);
        const color = DOT_COLOR[region] || "var(--text-faint)";
        return (
          <div className="timeline-item" key={i}>
            <div className="timeline-dot" style={{ background: color }} />
            <div className="timeline-body">
              <div className="ttype">{injury.type}</div>
              <div className="timeline-dates">
                {formatDate(injury.from)} &ndash; {formatDate(injury.until)}
              </div>
              <div className="timeline-days">{daysBetween(injury.from, injury.until)} days out</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
