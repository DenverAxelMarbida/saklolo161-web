import axios from "axios";
import { API_BASE_URL } from "./config";
import { getStoredAuth, logout } from "./auth";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the stored JWT (if any) to every request. The dispatcher's
// protected endpoints (GET /api/incidents, dispatch, status updates)
// require a `Bearer <token>` Authorization header; signed-out calls
// (e.g. the citizen-facing mobile paths) simply go out without one.
api.interceptors.request.use((config) => {
  const auth = getStoredAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// The backend's protected routes return 401 when the token is missing,
// invalid, or expired. Rather than let the dispatcher land on a
// silently-failing screen (e.g. an empty incident queue), treat any 401
// as "logged out". logout() clears localStorage and notifies the
// onAuthChange subscription, which flips App's authState to null and
// re-renders Login. It does NOT reload — an unauthorized poll request
// would otherwise deadlock the app in an endless reload loop (the poll
// keeps hitting the protected endpoint, gets 401, reloads, repeats).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  },
);

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

// The backend's PATCH /api/incidents/:id/status endpoint accepts any
// status value in VALID_STATUSES (Pending/Dispatched/En Route/Resolved)
// via a single generic handler — so all status transitions go through
// this one function. resolveIncident/markEnRoute are thin, named
// wrappers over it for call-site readability.
export const updateIncidentStatus = async (incidentId, status) => {
  const response = await api.patch(`/api/incidents/${incidentId}/status`, {
    status,
  });

  return response.data;
};

export const resolveIncident = (incidentId) =>
  updateIncidentStatus(incidentId, "Resolved");

export const markEnRoute = (incidentId) =>
  updateIncidentStatus(incidentId, "En Route");