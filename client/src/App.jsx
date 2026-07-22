import React, { useEffect, useState } from "react";
import { fetchDemoPlayer, searchPlayer } from "./api";
import RiskGauge from "./components/RiskGauge.jsx";
import BodyHeatmap from "./components/BodyHeatmap.jsx";
import NextMatchCard from "./components/NextMatchCard.jsx";
import InjuryTimeline from "./components/InjuryTimeline.jsx";
import { NATIONALITIES } from "./constants/nationalities";

export default function App() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [nationality, setNationality] = useState("");
  const [club, setClub] = useState("");
  const [showRefine, setShowRefine] = useState(false);

  useEffect(() => {
    loadDemo();
  }, []);

  async function loadDemo() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDemoPlayer();
      setPlayer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchPlayer(query.trim(), {
        nationality: nationality.trim(),
        club: club.trim()
      });
      setPlayer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          Injury<span>Trends</span>
        </div>
        <div className="tag">FOOTBALLER RISK ANALYSIS — PROOF OF CONCEPT</div>
      </div>

      <form onSubmit={handleSearch}>
        <div className="search-row">
          <input
            type="text"
            placeholder="Search a player by name (live scrape)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" type="submit">
            Analyze
          </button>
          <button className="btn" type="button" onClick={loadDemo}>
            Demo player
          </button>
        </div>

        <button
          type="button"
          className="link-btn refine-toggle"
          onClick={() => setShowRefine((v) => !v)}
        >
          {showRefine ? "− Hide refinement" : "+ Refine search (common surname? narrow it down)"}
        </button>

        {showRefine && (
          <div className="refine-row">
            <input
              type="text"
              list="nationality-options"
              placeholder="Nationality (optional)"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
            <datalist id="nationality-options">
              {NATIONALITIES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <input
              type="text"
              placeholder="Current club (optional)"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </div>
        )}
      </form>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {loading && <div className="loading-state">Gathering injury data…</div>}

      {!loading && player && (
        <>
          <div className="player-header">
            <div>
              <h1>{player.name}</h1>
              <div className="player-meta">
                <span>{player.injuryCount} recorded injuries</span>
                {player.dateOfBirth && (
                  <span>Born {new Date(player.dateOfBirth).toLocaleDateString()}</span>
                )}
                {player.nationality && <span>{player.nationality}</span>}
                {player.club && <span>{player.club}</span>}
              </div>
            </div>
            <span className={`source-pill ${player.live ? "live" : ""}`}>
              {player.live ? "● LIVE SOURCE" : "○ CACHED DEMO DATA"}
            </span>
          </div>

          <div className="grid">
            <div className="panel">
              <h2 className="panel-title">Risk Score</h2>
              <RiskGauge riskScore={player.riskScore} />
            </div>

            <div className="panel">
              <h2 className="panel-title">Body Heatmap</h2>
              <BodyHeatmap heatMap={player.heatMap} />
            </div>

            <div className="panel">
              <h2 className="panel-title">Next Match Prediction</h2>
              <NextMatchCard prediction={player.prediction} nextMatchDate={player.nextMatchDate} />
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h2 className="panel-title">Injury History</h2>
            <InjuryTimeline injuries={player.injuries} />
          </div>

          <div className="disclaimer">
            This is a proof-of-concept analytics tool. Risk scores and predictions are
            derived from a heuristic model over publicly reported injury data, not a
            validated medical or statistical model, and should not be used for real
            clinical, fitness, or betting decisions. Injury data accuracy depends on the
            source site and may be incomplete or delayed.
          </div>
        </>
      )}

      {!loading && !player && !error && (
        <div className="empty-state">Search for a player to begin.</div>
      )}
    </div>
  );
}
