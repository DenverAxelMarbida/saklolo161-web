import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DispatchTracker from "../src/components/DispatchTracker";
import { fetchRoute } from "../src/lib/api";

vi.mock("../src/components/RouteMap", () => ({
  default: () => <div data-testid="route-map" />,
}));

vi.mock("../src/lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchRoute: vi.fn(),
    resolveIncident: vi.fn(() => Promise.resolve()),
    markEnRoute: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("../src/lib/geo", () => ({
  straightLineEstimate: () => ({ distanceMeters: 1600, durationSeconds: 144 }),
}));

function makeIncident(overrides = {}) {
  return {
    id: "INC-20260911-7659",
    category: "FIRE",
    status: "DISPATCHED",
    coords: { lat: 14.5958, lng: 120.9772 },
    station: {
      id: "FIRE_BFP_MAIN",
      name: "BFP Main",
      coords: { lat: 14.6331, lng: 121.0976 },
    },
    dispatch: {
      stationId: "FIRE_BFP_MAIN",
      stationName: "BFP Main",
      assignedUnit: "BFP-01",
      estimatedTurnout: "2–5 mins",
      arrivalEtaMinutes: 66,
    },
    ...overrides,
  };
}

function renderTracker(incident) {
  return render(
    <DispatchTracker
      incident={incident}
      onClose={() => {}}
      onResolved={() => {}}
      onStatusUpdated={() => {}}
    />,
  );
}

describe("DispatchTracker metric readout", () => {
  beforeEach(() => {
    fetchRoute.mockResolvedValue({
      geometry: {
        type: "LineString",
        coordinates: [
          [121.0976, 14.6331],
          [120.9772, 14.5958],
        ],
      },
      distanceMeters: 1600,
      durationSeconds: 144,
    });
  });

  it("shows computed distance/ETA alongside the station turnout string", async () => {
    renderTracker(makeIncident());

    expect(await screen.findByText("1.6 km")).toBeTruthy();
    expect(screen.getByText("~2 min")).toBeTruthy();
    expect(screen.getByText("2–5 mins")).toBeTruthy();
  });

  it("renders an em-dash turnout when no dispatch exists yet", async () => {
    renderTracker(makeIncident({ dispatch: null }));

    const dashes = await screen.findAllByText("—");
    expect(dashes.length).toBe(1);
  });
});