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
  return response.data;
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