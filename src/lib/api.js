import { API_BASE_URL } from "./config";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${res.status}`);
  }
  // 204 No Content has no body to parse.
  return res.status === 204 ? null : res.json();
}

export const getWeatherRiver = () => request("/api/weather-river");

export const getIncidents = () => request("/api/incidents");

export const dispatchIncident = ({ incidentId, stationId, assignedUnit }) =>
  request("/api/incidents/dispatch", {
    method: "POST",
    body: JSON.stringify({ incidentId, stationId, assignedUnit }),
  });

export const resolveIncident = (incidentId) =>
  request(`/api/incidents/${incidentId}/resolve`, { method: "POST" });
