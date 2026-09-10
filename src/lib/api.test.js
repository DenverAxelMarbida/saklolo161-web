import { describe, it, expect, vi, beforeEach } from "vitest";

// A single mocked axios instance shared by api.js and auth.js. api.js
// calls axios.create(...) at module load, and the response interceptor is
// registered against it, so the instance must expose interceptors.
const apiInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => apiInstance),
    post: vi.fn(),
  },
}));

import { getWeatherRiver, fetchRoute, normalizeIncident, getIncidents } from "./api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeIncident", () => {
  it("maps backend field casing/layout onto the UI shape", () => {
    const raw = {
      incidentId: "FIRE-24-0001",
      category: "fire",
      status: "en route",
      priority: "HIGH",
      location: { address: "Sto. Nino, Marikina City", latitude: 14.6395, longitude: 121.108 },
      elapsedMinutes: 12,
      notes: "Heavy smoke from a 2-storey residence.",
    };

    expect(normalizeIncident(raw)).toEqual({
      id: "FIRE-24-0001",
      category: "FIRE",
      status: "EN ROUTE",
      priority: "HIGH",
      location: "Sto. Nino, Marikina City",
      coords: { lat: 14.6395, lng: 121.108 },
      elapsedMinutes: 12,
      callerNotes: "Heavy smoke from a 2-storey residence.",
      evidence: [],
      station: null,
      dispatch: null,
      resolvedAt: null,
    });
  });

  it("passes the evidence array through unchanged (backend object shape)", () => {
    const evidence = [
      { fileId: "f1", url: "https://cdn/evidence.jpg", mimeType: "image/jpeg", uploadedAt: "2026-09-08T01:00:00Z" },
      { fileId: "f2", url: "", mimeType: "video/mp4", uploadedAt: "2026-09-08T01:05:00Z" },
    ];

    expect(normalizeIncident({ id: "X", evidence }).evidence).toEqual(evidence);
  });

  it("passes the top-level station record through for routing", () => {
    const station = { id: "s1", name: "BFP Main Station", coords: { lat: 14.6, lng: 121.1 } };

    expect(normalizeIncident({ id: "X", station }).station).toEqual(station);
  });

  it("defaults missing evidence to an empty array", () => {
    expect(normalizeIncident({ id: "X" }).evidence).toEqual([]);
  });
});

describe("getIncidents", () => {
  it("maps the envelope's data array through normalizeIncident", async () => {
    apiInstance.get.mockResolvedValueOnce({
      data: {
        data: [
{ id: "A", category: "medical", location: { address: "Malanday", latitude: 1, longitude: 2 } },
      { id: "B" },
        ],
      },
    });

    const incidents = await getIncidents();
    expect(incidents).toHaveLength(2);
    expect(incidents[0].category).toBe("MEDICAL");
    expect(incidents[0].status).toBe("PENDING");
    expect(incidents[0].location).toBe("Malanday");
    expect(incidents[0].coords).toEqual({ lat: 1, lng: 2 });
  });

  it("returns an empty array when the payload has no data array", async () => {
    apiInstance.get.mockResolvedValueOnce({ data: { success: true, message: "ok" } });

    await expect(getIncidents()).resolves.toEqual([]);
  });
});

describe("getWeatherRiver", () => {
  it("parses temperature, risk, and river status from the response", async () => {
    apiInstance.get.mockResolvedValueOnce({
      data: {
        data: {
          temperature: "30°C",
          condition: "Cloudy",
          riskLevel: "MEDIUM RISK",
          riverLevelMeters: 15.2,
          riverStatus: "Normal",
          source: "pagasa",
        },
      },
    });

    const result = await getWeatherRiver();
    expect(result.weather).toEqual({ tempC: 30, condition: "Cloudy", risk: "MEDIUM" });
    expect(result.river).toMatchObject({ levelM: 15.2, status: "NORMAL" });
    expect(result.river.sparkline).toHaveLength(12);
  });

  it("coerces a numeric temperature string into an integer", async () => {
    apiInstance.get.mockResolvedValueOnce({
      data: { data: { temperature: "28.5°C", riskLevel: "LOW RISK", riverStatus: "Normal" } },
    });

    const result = await getWeatherRiver();
    expect(result.weather.tempC).toBe(28);
  });
});

describe("fetchRoute", () => {
  it("requests /api/routes with the coordinates as query params and unwraps data", async () => {
    const payload = {
      geometry: { type: "LineString", coordinates: [[121.0, 14.6], [121.1, 14.65]] },
      distanceMeters: 2400,
      durationSeconds: 420,
    };
    apiInstance.get.mockResolvedValueOnce({ data: { success: true, message: "ok", data: payload } });

    const result = await fetchRoute({ fromLat: 14.6, fromLng: 121.0, toLat: 14.65, toLng: 121.1 });

    expect(apiInstance.get).toHaveBeenCalledWith("/api/routes", {
      params: { fromLat: 14.6, fromLng: 121.0, toLat: 14.65, toLng: 121.1 },
    });
    expect(result).toEqual(payload);
  });

  it("rejects so callers can fall back (backend-down handling)", async () => {
    apiInstance.get.mockRejectedValueOnce(new Error("backend unreachable"));

    await expect(
      fetchRoute({ fromLat: 1, fromLng: 2, toLat: 3, toLng: 4 }),
    ).rejects.toThrow("backend unreachable");
  });
});