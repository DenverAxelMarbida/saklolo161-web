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

export const getIncidents = async () => {
  const response = await api.get("/api/incidents");
  return response.data;
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
  const response = await api.post(`/api/incidents/${incidentId}/resolve`);

  return response.data;
};