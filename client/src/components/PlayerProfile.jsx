import React, { useState } from "react";

function initials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export default function PlayerProfile({ player }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(player.photo) && !photoFailed;

  const details = [
    { label: "Date of birth", value: player.dateOfBirth && new Date(player.dateOfBirth).toLocaleDateString() },
    { label: "Age", value: player.age },
    { label: "Nationality", value: player.nationality },
    { label: "Current club", value: player.club },
    { label: "Position", value: player.position },
    { label: "Squad number", value: player.number }
  ].filter((d) => d.value);

  return (
    <div className="panel profile-panel">
      <h2 className="panel-title">Player Profile</h2>
      <div className="profile-body">
        {showPhoto ? (
          <img
            className="profile-photo"
            src={player.photo}
            alt={player.name}
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="profile-photo profile-photo-fallback" aria-hidden="true">
            {initials(player.name)}
          </div>
        )}

        {details.length > 0 ? (
          <dl className="profile-details">
            {details.map((d) => (
              <div className="profile-detail-row" key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="no-notes">No further profile details available for this player.</div>
        )}
      </div>
    </div>
  );
}
