import React, { useMemo, useState } from "react";

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

// Football-season grouping (Jul–Jun) rather than calendar year, since that's
// how squads, fixtures, and injury reporting are actually organized.
function seasonLabel(iso) {
  const d = new Date(iso);
  const startYear = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function groupBySeason(injuries) {
  const groups = new Map();
  for (const injury of injuries) {
    const label = seasonLabel(injury.from);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(injury);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([season, list]) => {
      const totalDays = list.reduce((sum, inj) => sum + daysBetween(inj.from, inj.until), 0);
      const regionCounts = {};
      for (const inj of list) {
        const region = classify(inj.type) || "other";
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      }
      const dominant = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0][0];
      return { season, injuries: list, totalDays, count: list.length, dominant };
    });
}

export default function InjuryTimeline({ injuries }) {
  const groups = useMemo(() => groupBySeason(injuries), [injuries]);
  const [expanded, setExpanded] = useState(() => new Set(groups[0] ? [groups[0].season] : []));
  const maxDays = Math.max(1, ...groups.map((g) => g.totalDays));

  function toggle(season) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });
  }

  return (
    <div className="timeline-groups">
      <div className="timeline-controls">
        <button type="button" className="link-btn" onClick={() => setExpanded(new Set(groups.map((g) => g.season)))}>
          Expand all
        </button>
        <span className="dot-sep">·</span>
        <button type="button" className="link-btn" onClick={() => setExpanded(new Set())}>
          Collapse all
        </button>
      </div>

      {groups.map((group) => {
        const isOpen = expanded.has(group.season);
        const barColor = DOT_COLOR[group.dominant] || "var(--text-faint)";
        return (
          <div className="season-group" key={group.season}>
            <button
              type="button"
              className="season-header"
              onClick={() => toggle(group.season)}
              aria-expanded={isOpen}
            >
              <span className="season-chevron">{isOpen ? "▾" : "▸"}</span>
              <span className="season-label">{group.season}</span>
              <span className="season-bar-track">
                <span
                  className="season-bar-fill"
                  style={{ width: `${(group.totalDays / maxDays) * 100}%`, background: barColor }}
                />
              </span>
              <span className="season-stats">
                {group.count} {group.count === 1 ? "injury" : "injuries"} &middot; {group.totalDays}d out
              </span>
            </button>

            {isOpen && (
              <div className="timeline">
                {group.injuries.map((injury, i) => {
                  const region = classify(injury.type);
                  const dotColor = DOT_COLOR[region] || "var(--text-faint)";
                  return (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-dot" style={{ background: dotColor }} />
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
            )}
          </div>
        );
      })}
    </div>
  );
}
