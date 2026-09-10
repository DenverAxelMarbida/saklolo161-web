import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import RouteMap from "../src/components/RouteMap";
import { fetchRoute } from "../src/lib/api";

const { mockMap } = vi.hoisted(() => ({
  mockMap: {
    isStyleLoaded: vi.fn(() => true),
    once: vi.fn(),
    getSource: vi.fn(() => null),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    setData: vi.fn(),
  },
}));

vi.mock("mapbox-gl", () => {
  class MockMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class MockLngLatBounds {
    extend() {
      return this;
    }
  }
  return {
    default: {
      accessToken: "",
      Map: vi.fn(),
      NavigationControl: vi.fn(),
      Marker: MockMarker,
      LngLatBounds: MockLngLatBounds,
    },
  };
});

vi.mock("../src/hooks/useMapboxMap", () => ({
  useMapboxMap: () => ({
    containerRef: { current: null },
    mapRef: { current: mockMap },
  }),
}));

vi.mock("../src/lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchRoute: vi.fn() };
});

const STATION = { lat: 14.6, lng: 121.0 };
const INCIDENT = { lat: 14.7, lng: 121.02 };
const ROUTED_COORDS = [
  [121.0, 14.6],
  [121.01, 14.65],
  [121.02, 14.7],
];

function lastDrawData() {
  const calls = mockMap.addSource.mock.calls;
  return calls[calls.length - 1][1].data;
}

describe("RouteMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default so tests that don't care about routing never hit an
    // undefined-mock crash; individual tests override this.
    fetchRoute.mockResolvedValue({
      geometry: null,
      distanceMeters: 0,
      durationSeconds: 0,
    });
  });

  it("renders a map container div", () => {
    const { container } = render(
      <RouteMap stationCoords={STATION} incidentCoords={INCIDENT} />,
    );

    expect(container.querySelector(".h-full.w-full")).toBeTruthy();
  });

  it("draws real routed geometry from fetchRoute", async () => {
    fetchRoute.mockResolvedValue({
      geometry: { type: "LineString", coordinates: ROUTED_COORDS },
      distanceMeters: 2400,
      durationSeconds: 420,
    });

    render(<RouteMap stationCoords={STATION} incidentCoords={INCIDENT} />);

    await waitFor(() => {
      expect(lastDrawData().geometry.coordinates).toEqual(ROUTED_COORDS);
    });

    expect(fetchRoute).toHaveBeenCalledWith({
      fromLat: STATION.lat,
      fromLng: STATION.lng,
      toLat: INCIDENT.lat,
      toLng: INCIDENT.lng,
    });
  });

  it("uses a passed-in geometry even before the fetch resolves", async () => {
    render(
      <RouteMap
        stationCoords={STATION}
        incidentCoords={INCIDENT}
        geometry={{ type: "LineString", coordinates: ROUTED_COORDS }}
      />,
    );

    await waitFor(() => {
      expect(mockMap.addSource).toHaveBeenCalled();
    });

    expect(fetchRoute).not.toHaveBeenCalled();
    expect(lastDrawData().geometry.coordinates).toEqual(ROUTED_COORDS);
  });

  it("falls back to a straight line between the two points when the route fetch fails", async () => {
    fetchRoute.mockRejectedValue(new Error("backend down"));

    render(<RouteMap stationCoords={STATION} incidentCoords={INCIDENT} />);

    await waitFor(() => {
      expect(mockMap.addSource).toHaveBeenCalled();
    });

    const feature = lastDrawData();
    expect(feature.geometry.type).toBe("LineString");
    expect(feature.geometry.coordinates).toEqual([
      [STATION.lng, STATION.lat],
      [INCIDENT.lng, INCIDENT.lat],
    ]);
  });

  it("does not draw a route line when coords are missing", () => {
    const { container } = render(
      <RouteMap stationCoords={null} incidentCoords={{ lat: 1, lng: 2 }} />,
    );

    expect(container.querySelector(".h-full.w-full")).toBeTruthy();
    expect(mockMap.addSource).not.toHaveBeenCalled();
  });
});