import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

    const turnoutLabel = await screen.findByText("Turnout");
    // Scope to the turnout cell — other stats (e.g. phone) also fall back to a dash.
    expect(turnoutLabel.nextElementSibling.textContent).toBe("—");
  });

  it("marks the distance as approximate until the real route arrives", async () => {
    let resolveFetch;
    fetchRoute.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    renderTracker(makeIncident());

    expect(screen.getByText("≈1.6 km")).toBeTruthy();
    expect(screen.queryByText("1.6 km")).toBeNull();

    resolveFetch({
      geometry: null,
      distanceMeters: 2400,
      durationSeconds: 300,
    });

    expect(await screen.findByText("2.4 km")).toBeTruthy();
    expect(screen.queryByText("≈1.6 km")).toBeNull();
  });
});

describe("DispatchTracker — dialog dismissal", () => {
  it("is a labelled dialog that closes on Escape", () => {
    fetchRoute.mockResolvedValue({ geometry: null });
    const onClose = vi.fn();
    render(
      <DispatchTracker
        incident={makeIncident()}
        onClose={onClose}
        onResolved={() => {}}
        onStatusUpdated={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Live Dispatch Tracker");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("styles MARK EN ROUTE with the risk-mid token, not a raw hex", () => {
    fetchRoute.mockResolvedValue({ geometry: null });
    renderTracker(makeIncident());

    const button = screen.getByText("MARK EN ROUTE");
    expect(button.className).toContain("bg-risk-mid");
    expect(button.className).toContain("text-header");
  });
});
describe("DispatchTracker — citizen phone", () => {
  it("renders the canonical phone number in the incident facts grid", () => {
    fetchRoute.mockResolvedValue({ geometry: null });
    renderTracker(makeIncident({ citizenPhone: "+639171234567" }));

    expect(screen.getByText("Phone Number")).toBeTruthy();
    expect(screen.getByText("+639171234567")).toBeTruthy();
  });

  it("shows a graceful dash when the incident has no phone number", () => {
    fetchRoute.mockResolvedValue({ geometry: null });
    renderTracker(makeIncident());

    const label = screen.getByText("Phone Number");
    expect(label.nextElementSibling.textContent).toBe("—");
  });
});
