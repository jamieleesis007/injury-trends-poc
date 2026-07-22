const BASE = "/api";

export async function fetchDemoPlayer() {
  const res = await fetch(`${BASE}/players/marco-reus`);
  if (!res.ok) throw new Error("Failed to load demo player");
  return res.json();
}

export async function searchPlayer(name, filters = {}) {
  const params = new URLSearchParams({ name });
  if (filters.nationality) params.set("nationality", filters.nationality);
  if (filters.club) params.set("club", filters.club);

  const res = await fetch(`${BASE}/players/search?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Search failed");
  return data;
}
