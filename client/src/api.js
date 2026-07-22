const BASE = "/api";

export async function fetchDemoPlayer() {
  const res = await fetch(`${BASE}/players/marco-reus`);
  if (!res.ok) throw new Error("Failed to load demo player");
  return res.json();
}

export async function searchPlayer(name) {
  const res = await fetch(`${BASE}/players/search?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Search failed");
  return data;
}
