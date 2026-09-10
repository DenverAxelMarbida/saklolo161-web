import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DispatchTracker from "./DispatchTracker";

vi.mock("../lib/api", () => ({
  fetchRoute: vi.fn(),
  resolveIncident: vi.fn(),
  markEnRoute: vi.fn(),
}));
import { fetchRoute } from "../lib/api";

// Same mapbox-gl mock as RouteMap.test.jsx — DispatchTracker renders
// RouteMap, which needs a WebGL-free Map implementation under jsdom.
const mapboxMock = vi.hoisted(() => {
  const instances = [];
  class NavigationControl {}
  class Marker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  class Map {
    constructor() {
      Object.assign(this, {
        addControl: vi.fn(),
        remove: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
        getSource: vi.fn(),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        fitBounds: vi.fn(),
        jumpTo: vi.fn(),
      });
      instances.push(this);
    }
  }
  return {
    Map,
    Marker,
    LngLatBounds,
    NavigationControl,
    last: () => instances[instances.length - 1] ?? null,
    clear: () => {
      instances.length = 0;
    },
  };
});

vi.mock("mapbox-gl", () => ({
  default: {
    Map: mapboxMock.Map,
    Marker: mapboxMock.Marker,
    LngLatBounds: mapboxMock.LngLatBounds,
    NavigationControl: mapboxMock.NavigationControl,
    accessToken: "",
  },
}));

const STATION = { lat: 14.64, lng: 121.1 };
const INCIDENT = { lat: 14.65, lng: 121.11 };

const incident = {
  id: "FIRE-24-0001",
  category: "FIRE",
  status: "EN ROUTE",
  priority: "HIGH",
  coords: INCIDENT,
  location: "Sto. Nino, Marikina City",
  callerNotes: "Heavy smoke.",
  evidence: [],
  station: { id: "FIRE_BFP_MAIN_STATION", name: "BFP Main Station", coords: STATION },
};

const renderTracker = (overrides = {}) =>
  render(
    <DispatchTracker
      incident={{ ...incident, ...overrides }}
      onClose={vi.fn()}
      onResolved={vi.fn()}
      onStatusUpdated={vi.fn()}
    />,
  );

beforeEach(() => {
  mapboxMock.clear();
  vi.clearAllMocks();
});

describe("DispatchTracker", () => {
  it("requests the route from the station to the incident", async () => {
    fetchRoute.mockResolvedValueOnce({
      geometry: { type: "LineString", coordinates: [[121.1, 14.64], [121.11, 14.65]] },
      distanceMeters: 2400,
      durationSeconds: 420,
    });

    renderTracker();
    expect(await screen.findByText("2.4 km")).toBeInTheDocument();
    expect(screen.getByText("~7 min")).toBeInTheDocument();

    expect(fetchRoute).toHaveBeenCalledWith({
      fromLat: STATION.lat,
      fromLng: STATION.lng,
      toLat: INCIDENT.lat,
      toLng: INCIDENT.lng,
    });
  });

  it("degrades to the straight-line fallback and dash metrics on route failure", async () => {
    fetchRoute.mockRejectedValueOnce(new Error("backend down"));

    renderTracker();

    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    const map = mapboxMock.last();
    expect(map.addSource.mock.calls[0][1].data.geometry.coordinates).toEqual([
      [STATION.lng, STATION.lat],
      [INCIDENT.lng, INCIDENT.lat],
    ]);
  });

  it("keeps the mark-en-route stepper keyed to the incident's real status", () => {
    fetchRoute.mockResolvedValue({
      geometry: { type: "LineString", coordinates: [[121.1, 14.64], [121.11, 14.65]] },
      distanceMeters: 1000,
      durationSeconds: 120,
    });

    const { rerender } = renderTracker({ status: "EN ROUTE" });
    expect(screen.getByText("MARK RESOLVED")).toBeInTheDocument();
    expect(screen.queryByText("MARK EN ROUTE")).not.toBeInTheDocument();

    rerender(
      <DispatchTracker
        incident={{ ...incident, status: "DISPATCHED" }}
        onClose={vi.fn()}
        onResolved={vi.fn()}
        onStatusUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText("MARK EN ROUTE")).toBeInTheDocument();
    expect(screen.queryByText("MARK RESOLVED")).not.toBeInTheDocument();
    expect(screen.getByText("DISPATCHED")).toBeInTheDocument();
  });
});