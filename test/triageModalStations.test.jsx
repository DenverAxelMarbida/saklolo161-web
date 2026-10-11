import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TriageModal from "../src/components/TriageModal";

const { stationApi } = vi.hoisted(() => ({
  stationApi: {
    dispatchIncident: vi.fn(),
    listStations: vi.fn(),
    normalizeIncident: (i) => i,
  },
}));

vi.mock("../src/lib/api", () => stationApi);

vi.mock("../src/components/MiniIncidentMap", () => ({
  default: () => <div data-testid="mini-map" />,
}));

function makeIncident(overrides = {}) {
  return {
    id: "INC-TEST-0001",
    category: "FLOOD",
    status: "PENDING",
    priority: "MEDIUM",
    location: "Marikina City",
    coords: { lat: 14.65, lng: 121.1 },
    citizenPhone: "+639171234567",
    callerNotes: "Water rising near the bridge.",
    evidence: [],
    station: null,
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

const LIVE_FLOOD_STATIONS = [
  {
    id: "FLOOD_RIVER_COMMAND",
    name: "River Park Authority",
    category: "Flood",
    assignedUnits: [
      { id: "boat-1", name: "Rescue Boat Unit #1", isActive: true },
      { id: "boat-2", name: "Rescue Boat Unit #2", isActive: false },
    ],
  },
  {
    id: "FLOOD_NEW_OUTPOST",
    name: "Nangka Flood Outpost",
    category: "Flood",
    assignedUnits: ["Swiftwater Team A"],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  stationApi.listStations.mockResolvedValue(structuredClone(LIVE_FLOOD_STATIONS));
  stationApi.dispatchIncident.mockResolvedValue({ data: { incidentId: "INC-TEST-0001" } });
});

describe("TriageModal — dynamic station loading", () => {
  it("requests the backend Title-Case category for the incident", async () => {
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={() => {}} />,
    );

    await waitFor(() => expect(stationApi.listStations).toHaveBeenCalledTimes(1));
    expect(stationApi.listStations).toHaveBeenCalledWith({ category: "Flood" });
  });

  it("replaces the static fallback with the live active stations", async () => {
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={() => {}} />,
    );

    // The admin-added station (not in the static config) appears.
    expect(await screen.findByText("Nangka Flood Outpost")).toBeTruthy();
    const stationSelect = document.getElementById("station");
    expect(stationSelect.value).toBe("FLOOD_RIVER_COMMAND");
  });

  it("shows only active units of the selected station and resets on station change", async () => {
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={() => {}} />,
    );
    expect(await screen.findByText("Nangka Flood Outpost")).toBeTruthy();

    const unitSelect = document.getElementById("unit");
    const unitOptions = within(unitSelect).getAllByRole("option").map((o) => o.textContent);
    // Inactive "Rescue Boat Unit #2" is excluded.
    expect(unitOptions).toEqual(["Rescue Boat Unit #1"]);

    // Switching stations resets the unit to the new station's first unit.
    fireEvent.change(document.getElementById("station"), {
      target: { value: "FLOOD_NEW_OUTPOST" },
    });
    expect(document.getElementById("unit").value).toBe("Swiftwater Team A");
  });

  it("dispatches with the live station + unit selection", async () => {
    const onDispatched = vi.fn();
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={onDispatched} />,
    );
    expect(await screen.findByText("Nangka Flood Outpost")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /DISPATCH RIVER PARK AUTHORITY UNIT/ }));

    await waitFor(() => expect(stationApi.dispatchIncident).toHaveBeenCalledTimes(1));
    expect(stationApi.dispatchIncident).toHaveBeenCalledWith({
      incidentId: "INC-TEST-0001",
      stationId: "FLOOD_RIVER_COMMAND",
      assignedUnit: "Rescue Boat Unit #1",
    });
  });

  it("falls back to the static list with a notice when the backend is unreachable", async () => {
    stationApi.listStations.mockRejectedValueOnce(new Error("network down"));
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={() => {}} />,
    );

    // Static fallback still renders (dispatch stays possible).
    expect(await screen.findByText("Live station list unavailable — showing default stations.")).toBeTruthy();
    expect(screen.getByText("River Park Authority")).toBeTruthy();
  });

  it("disables dispatch and shows an empty state when no active stations exist", async () => {
    stationApi.listStations.mockResolvedValueOnce([]);
    render(
      <TriageModal incident={makeIncident()} onClose={() => {}} onDispatched={() => {}} />,
    );

    expect(await screen.findByText("No active stations available")).toBeTruthy();
    const dispatchButton = screen.getByRole("button", { name: "NO ACTIVE STATION AVAILABLE" });
    expect(dispatchButton.disabled).toBe(true);
    expect(stationApi.dispatchIncident).not.toHaveBeenCalled();
  });

  it("renders a safe error instead of crashing on an unknown category", async () => {
    render(
      <TriageModal
        incident={makeIncident({ category: "ALIEN" })}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(await screen.findByText(/Unknown incident category/)).toBeTruthy();
    expect(stationApi.listStations).not.toHaveBeenCalled();
  });
});
