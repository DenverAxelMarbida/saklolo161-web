import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeIncident,
  getWeatherRiver,
  fetchRoute,
  getIncidents,
} from "../src/lib/api";

const { mockGet, mockPost, apiInstance } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPatch = vi.fn();
  return {
    mockGet,
    mockPost,
    apiInstance: {
      get: mockGet,
      post: mockPost,
      patch: mockPatch,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

vi.mock("axios", () => ({
  default: {
    create: () => apiInstance,
    post: mockPost,
  },
  create: () => apiInstance,
}));

describe("normalizeIncident", () => {
  it("maps backend field casing into the UI shape", () => {
    const normalized = normalizeIncident({
      incidentId: "FIRE-24-0001",
      category: "fire",
      status: "pending",
      priority: "HIGH",
      location: {
        address: "Sto. Nino, Marikina City",
        latitude: 14.6395,
        longitude: 121.108,
      },
      notes: "Heavy smoke reported.",
      evidence: [
        {
          fileId: "f1",
          url: "https://cdn.example/a.jpg",
          mimeType: "image/jpeg",
          uploadedAt: "2026-09-08T00:00:00Z",
        },
      ],
      dispatch: { stationId: "FIRE_BFP_MAIN_STATION" },
      resolvedAt: "2026-09-08T01:00:00Z",
    });

    expect(normalized.id).toBe("FIRE-24-0001");
    expect(normalized.category).toBe("FIRE");
    expect(normalized.status).toBe("PENDING");
    expect(normalized.priority).toBe("HIGH");
    expect(normalized.location).toBe("Sto. Nino, Marikina City");
    expect(normalized.coords).toEqual({ lat: 14.6395, lng: 121.108 });
    expect(normalized.callerNotes).toBe("Heavy smoke reported.");
    expect(normalized.evidence).toEqual([
      {
        fileId: "f1",
        url: "https://cdn.example/a.jpg",
        mimeType: "image/jpeg",
        uploadedAt: "2026-09-08T00:00:00Z",
      },
    ]);
    expect(normalized.dispatch).toEqual({
      stationId: "FIRE_BFP_MAIN_STATION",
    });
    expect(normalized.resolvedAt).toBe("2026-09-08T01:00:00Z");
  });

  it("passes the station (with coords) through for DispatchTracker", () => {
    const normalized = normalizeIncident({
      incidentId: "FLOOD-24-0003",
      station: {
        id: "FLOOD_RIVER_COMMAND",
        name: "River Park Authority",
        coords: { lat: 14.635687529310072, lng: 121.09384592111986 },
      },
    });

    expect(normalized.station).toEqual({
      id: "FLOOD_RIVER_COMMAND",
      name: "River Park Authority",
      coords: { lat: 14.635687529310072, lng: 121.09384592111986 },
    });
    expect(normalized.station.coords.lat).toBe(14.635687529310072);
  });

  it("falls back to legacy flat lat/lng and plain-string location", () => {
    const normalized = normalizeIncident({
      id: "MEDICAL-24-0002",
      location: "Riverbanks, Marikina City",
      lat: 14.6363,
      lng: 121.0982,
    });

    expect(normalized.id).toBe("MEDICAL-24-0002");
    expect(normalized.location).toBe("Riverbanks, Marikina City");
    expect(normalized.coords).toEqual({ lat: 14.6363, lng: 121.0982 });
    expect(normalized.status).toBe("PENDING");
    expect(normalized.priority).toBe("MEDIUM");
  });

  it("uses zero coords and defaults when fields are missing", () => {
    const normalized = normalizeIncident({ incidentId: "X-1" });

    expect(normalized.location).toBe("Unknown location");
    expect(normalized.coords).toEqual({ lat: 0, lng: 0 });
    expect(normalized.callerNotes).toBe("");
    expect(normalized.evidence).toEqual([]);
    expect(normalized.station).toBeNull();
    expect(normalized.dispatch).toBeNull();
    expect(normalized.resolvedAt).toBeNull();
  });

  it("passes evidence through untouched", () => {
    const evidence = [
      { fileId: "a", url: "", mimeType: "image/jpeg", uploadedAt: "t" },
    ];
    expect(normalizeIncident({ incidentId: "a", evidence }).evidence).toBe(evidence);
  });

  it("computes elapsedMinutes from the timestamp when not provided directly", () => {
    const timestamp = new Date(Date.now() - 5 * 60000).toISOString();
    const normalized = normalizeIncident({ incidentId: "a", timestamp });

    expect(normalized.elapsedMinutes).toBeGreaterThanOrEqual(4);
    expect(normalized.elapsedMinutes).toBeLessThanOrEqual(6);
  });
});

describe("getWeatherRiver", () => {
  // clearAllMocks keeps mock implementations in place; every test below
  // sets its own, so only the call records need resetting. (mockReset +
  // mockRejectedValue is broken in vitest 5 — avoid it.)
  beforeEach(() => vi.clearAllMocks());

  it("maps the backend payload (tempC parse, risk token, river status)", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          temperature: "30°C",
          condition: "Partly cloudy",
          humidity: "70%",
          wind: "12 km/h",
          riskLevel: "LOW RISK",
          riverLevelMeters: 15.2,
          riverStatus: "Normal",
        },
      },
    });

    const result = await getWeatherRiver();

    expect(mockGet).toHaveBeenCalledWith("/api/weather-river");
    expect(result.weather.tempC).toBe(30);
    expect(result.weather.condition).toBe("Partly cloudy");
    expect(result.weather.humidity).toBe("70%");
    expect(result.weather.wind).toBe("12 km/h");
    expect(result.weather.risk).toBe("LOW");
    expect(result.river.levelM).toBe(15.2);
    expect(result.river.status).toBe("Normal");
  });

  it("parses a risky payload into an uppercase risk token", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          temperature: "34.5°C",
          condition: "Cloudy",
          humidity: "80%",
          wind: "25 km/h",
          riskLevel: "HIGH RISK",
          riverLevelMeters: 16.1,
          riverStatus: "ALERT",
        },
      },
    });

    const result = await getWeatherRiver();

    expect(result.weather.tempC).toBe(34);
    expect(result.weather.risk).toBe("HIGH");
    expect(result.river.status).toBe("ALERT");
  });
});

describe("fetchRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests the public route endpoint with lat/lng params and maps the payload", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          geometry: {
            type: "LineString",
            coordinates: [
              [121.0, 14.6],
              [121.01, 14.65],
              [121.02, 14.7],
            ],
          },
          distanceMeters: 2400,
          durationSeconds: 420,
        },
      },
    });

    const route = await fetchRoute({
      fromLat: 14.6,
      fromLng: 121.0,
      toLat: 14.7,
      toLng: 121.02,
    });

    expect(mockGet).toHaveBeenCalledWith("/api/routes", {
      params: { fromLat: 14.6, fromLng: 121.0, toLat: 14.7, toLng: 121.02 },
    });
    expect(route).toEqual({
      geometry: {
        type: "LineString",
        coordinates: [
          [121.0, 14.6],
          [121.01, 14.65],
          [121.02, 14.7],
        ],
      },
      distanceMeters: 2400,
      durationSeconds: 420,
    });
  });

  it("rejects when the backend is unavailable so callers can fall back", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    let thrown = null;
    try {
      await fetchRoute({ fromLat: 1, fromLng: 2, toLat: 3, toLng: 4 });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown?.message).toBe("network down");
  });
});

describe("getIncidents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a list payload through normalizeIncident", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            incidentId: "F-1",
            category: "fire",
            status: "pending",
            location: { address: "Sto. Nino", latitude: 14.6, longitude: 121.1 },
            notes: "n",
          },
        ],
      },
    });

    const incidents = await getIncidents();

    expect(mockGet).toHaveBeenCalledWith("/api/incidents");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: "F-1",
      category: "FIRE",
      status: "PENDING",
      coords: { lat: 14.6, lng: 121.1 },
    });
  });

  it("returns an empty list when the payload is not an array", async () => {
    mockGet.mockResolvedValue({ data: { data: null } });

    expect(await getIncidents()).toEqual([]);
  });
});