import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import RouteMap from "./RouteMap";

// mapbox-gl requires WebGL, which jsdom doesn't provide — mock the whole
// module with a minimal surface (Map/Marker/LngLatBounds/NavigationControl)
// plus a map instance that records the sources/layers RouteMap adds.
const mapboxMock = vi.hoisted(() => {
  const instances = [];

  class NavigationControl {}

  class Marker {
    setLngLat(_lngLat) {
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

beforeEach(() => {
  mapboxMock.clear();
});

describe("RouteMap", () => {
  it("renders the map container div", () => {
    const { container } = render(
      <RouteMap stationCoords={STATION} incidentCoords={INCIDENT} />,
    );

    // The component's sole element is the container the map mounts into.
    expect(container.firstChild).toHaveClass("h-full", "w-full");
  });

  it("draws a straight-line fallback geometry when no route geometry is provided", () => {
    render(<RouteMap stationCoords={STATION} incidentCoords={INCIDENT} />);

    const map = mapboxMock.last();
    expect(map).not.toBeNull();

    const [sourceId, source] = map.addSource.mock.calls[0];
    expect(sourceId).toBe("dispatch-route");
    expect(source.type).toBe("geojson");
    expect(source.data.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [STATION.lng, STATION.lat],
        [INCIDENT.lng, INCIDENT.lat],
      ],
    });
    expect(map.addLayer).toHaveBeenCalled();
    expect(map.addLayer.mock.calls[0][0].source).toBe("dispatch-route");
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it("draws the provided route geometry instead of the fallback", () => {
    const geometry = {
      type: "LineString",
      coordinates: [
        [121.0, 14.6],
        [121.05, 14.63],
        [121.11, 14.65],
      ],
    };
    render(
      <RouteMap stationCoords={STATION} incidentCoords={INCIDENT} geometry={geometry} />,
    );

    const map = mapboxMock.last();
    expect(map.addSource.mock.calls[0][1].data.geometry).toBe(geometry);
  });

  it("does not crash when station coords are missing (pre-dispatch)", () => {
    render(<RouteMap stationCoords={undefined} incidentCoords={INCIDENT} />);

    const map = mapboxMock.last();
    expect(map).not.toBeNull();
    // No anchored fallback line possible, so no route source is added —
    // but the incident marker center still applies.
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.jumpTo).toHaveBeenCalled();
    expect(map.jumpTo.mock.calls[0][0].center).toEqual([INCIDENT.lng, INCIDENT.lat]);
  });
});