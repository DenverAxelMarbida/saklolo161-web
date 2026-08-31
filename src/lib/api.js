import axios from "axios";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getWeatherRiver = async () => {
  const response = await api.get("/api/weather-river");
  const d = response.data.data; // backend wraps the payload in { success, message, data }

  return {
    weather: {
      tempC: parseInt(d.temperature, 10),       // "30°C" -> 30
      condition: d.condition,
      risk: d.riskLevel.split(" ")[0].toUpperCase(), // "LOW RISK" -> "LOW"
    },
    river: {
      levelM: d.riverLevelMeters,
      status: d.riverStatus.toUpperCase(),        // "Normal" -> "NORMAL"
      sparkline: Array(12).fill(d.riverLevelMeters), // no history endpoint yet — flat line as placeholder
    },
  };
};

// The backend serializes incidents in its own field casing/shape, but the
// UI was built against the mock-data shape (see data/mockIncidents.js).
// This normalizes every API incident into that expected shape so the map,
// queue, and tally all stay in sync regardless of backend schema changes.
const normalizeIncident = (i) => ({
  id: i.incidentId ?? i.id,
  category: (i.category || "").toUpperCase(),
  status: (i.status || "PENDING").toUpperCase(),
  priority: i.priority || "MEDIUM",
  location: i.location?.address ?? i.location ?? "Unknown location",
  coords: {
    lat: i.location?.latitude ?? i.lat ?? 0,
    lng: i.location?.longitude ?? i.lng ?? 0,
  },
  elapsedMinutes: i.elapsedMinutes ?? 0,
  callerNotes: i.notes ?? i.callerNotes ?? "",
  evidence: i.evidence ?? [],
});

export const getIncidents = async () => {
  const response = await api.get("/api/incidents");
  const d = response.data?.data ?? response.data;
  if (!Array.isArray(d)) return [];
  return d.map(normalizeIncident);
};

export const dispatchIncident = async ({
  incidentId,
  stationId,
  assignedUnit,
}) => {
  const response = await api.post("/api/incidents/dispatch", {
    incidentId,
    stationId,
    assignedUnit,
  });

  return response.data;
};

export const resolveIncident = async (incidentId) => {
  const response = await api.patch(`/api/incidents/${incidentId}/status`, {
    status: "Resolved",
  });

  return response.data;
};