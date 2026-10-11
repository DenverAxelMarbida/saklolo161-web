import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import StationManagement from "../src/components/StationManagement";

const { stationApi } = vi.hoisted(() => ({
  stationApi: {
    listStations: vi.fn(),
    createStation: vi.fn(),
    updateStation: vi.fn(),
    setStationActive: vi.fn(),
    addUnit: vi.fn(),
    updateUnit: vi.fn(),
    setUnitActive: vi.fn(),
  },
}));

vi.mock("../src/lib/api", () => stationApi);

const STATIONS = [
  {
    id: "FIRE_BFP_MAIN_STATION",
    name: "Bureau of Fire Protection Central Fire Station - Marikina City",
    category: "Fire",
    phone: "(02) 8681 0233",
    coords: { lat: 14.63, lng: 121.09 },
    estimatedTurnout: "3–5 mins",
    isActive: true,
    assignedUnits: [
      { id: "engine-1", name: "BFP Engine Pumper #1", isActive: true },
      { id: "engine-2", name: "BFP Engine Pumper #2", isActive: false },
    ],
  },
  {
    id: "FLOOD_RIVER_COMMAND",
    name: "River Park Authority",
    category: "Flood",
    phone: "",
    coords: { lat: 14.63, lng: 121.09 },
    estimatedTurnout: "",
    isActive: false,
    assignedUnits: ["Rescue Boat Unit #1"],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  stationApi.listStations.mockResolvedValue(structuredClone(STATIONS));
});

describe("StationManagement — listing", () => {
  it("loads stations with includeInactive and renders rows with status badges", async () => {
    render(<StationManagement embedded />);

    expect(await screen.findByText("Bureau of Fire Protection Central Fire Station - Marikina City")).toBeTruthy();
    expect(screen.getByText("River Park Authority")).toBeTruthy();
    expect(stationApi.listStations).toHaveBeenCalledWith({ includeInactive: true });
    // One active badge + one inactive badge (units panel closed).
    expect(screen.getAllByText("Active")).toHaveLength(1);
    expect(screen.getAllByText("Inactive")).toHaveLength(1);
  });

  it("shows a retryable error when loading fails", async () => {
    stationApi.listStations.mockRejectedValueOnce({
      response: { data: { message: "Server exploded." } },
    });
    render(<StationManagement embedded />);

    expect(await screen.findByText("Server exploded.")).toBeTruthy();
    stationApi.listStations.mockResolvedValue(structuredClone(STATIONS));
    fireEvent.click(screen.getByText("Retry"));
    expect(await screen.findByText("River Park Authority")).toBeTruthy();
  });

  it("renders an empty state when no stations exist", async () => {
    stationApi.listStations.mockResolvedValueOnce([]);
    render(<StationManagement embedded />);

    expect(await screen.findByText("No stations found.")).toBeTruthy();
  });
});

describe("StationManagement — station add/edit/activate", () => {
  it("creates a station through the Add Station modal", async () => {
    stationApi.createStation.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getByText("Add Station"));
    fireEvent.change(screen.getByLabelText("Station ID"), {
      target: { value: "MEDICAL_TEST_BASE" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test Medical Base" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Medical" },
    });
    fireEvent.click(screen.getByText("Create Station"));

    await waitFor(() => expect(stationApi.createStation).toHaveBeenCalledTimes(1));
    expect(stationApi.createStation).toHaveBeenCalledWith({
      id: "MEDICAL_TEST_BASE",
      name: "Test Medical Base",
      category: "Medical",
      phone: "",
      coords: null,
      estimatedTurnout: "",
    });
    expect(await screen.findByText("Station created.")).toBeTruthy();
  });

  it("surfaces backend validation errors inside the modal", async () => {
    stationApi.createStation.mockRejectedValueOnce({
      response: { data: { message: "Station X already exists." } },
    });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getByText("Add Station"));
    fireEvent.change(screen.getByLabelText("Station ID"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X Station" } });
    fireEvent.click(screen.getByText("Create Station"));

    expect(await screen.findByText("Station X already exists.")).toBeTruthy();
  });

  it("edits a station without touching its id", async () => {
    stationApi.updateStation.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    const rows = screen.getAllByText("Edit");
    fireEvent.click(rows[0]);
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Renamed Fire Station" } });
    expect(screen.queryByLabelText("Station ID")).toBeNull();
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(stationApi.updateStation).toHaveBeenCalledTimes(1));
    const [id, payload] = stationApi.updateStation.mock.calls[0];
    expect(id).toBe("FIRE_BFP_MAIN_STATION");
    expect(payload.name).toBe("Renamed Fire Station");
    expect(payload).not.toHaveProperty("id");
    expect(await screen.findByText("Station updated.")).toBeTruthy();
  });

  it("requires confirmation before deactivating a station", async () => {
    stationApi.setStationActive.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    // First click only arms the confirmation — no PATCH yet.
    expect(stationApi.setStationActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirm deactivate"));

    await waitFor(() => expect(stationApi.setStationActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setStationActive).toHaveBeenCalledWith("FIRE_BFP_MAIN_STATION", false);
    expect(await screen.findByText("Station deactivated.")).toBeTruthy();
  });

  it("activates an inactive station directly", async () => {
    stationApi.setStationActive.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getByText("Activate"));

    await waitFor(() => expect(stationApi.setStationActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setStationActive).toHaveBeenCalledWith("FLOOD_RIVER_COMMAND", true);
  });
});

describe("StationManagement — assigned units", () => {
  async function openUnits() {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Units" })[0]);
    expect(await screen.findByText("BFP Engine Pumper #1")).toBeTruthy();
  }

  it("lists a station's units with active/inactive badges, including legacy strings", async () => {
    await openUnits();
    // Object units: one active, one inactive.
    expect(screen.getByText("BFP Engine Pumper #2")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThanOrEqual(1);
  });

  it("adds a unit to the station", async () => {
    stationApi.addUnit.mockResolvedValue({ success: true });
    await openUnits();

    fireEvent.click(screen.getByText("Add Unit"));
    fireEvent.change(screen.getByLabelText("Unit ID"), { target: { value: "engine-9" } });
    fireEvent.change(screen.getByLabelText("Unit Name"), { target: { value: "Engine Pumper #9" } });
    // Two "Add Unit" buttons now exist (panel + modal submit) — the
    // modal's submit is the last one in the document.
    const addButtons = screen.getAllByText("Add Unit");
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => expect(stationApi.addUnit).toHaveBeenCalledTimes(1));
    expect(stationApi.addUnit).toHaveBeenCalledWith("FIRE_BFP_MAIN_STATION", {
      id: "engine-9",
      name: "Engine Pumper #9",
    });
  });

  it("renames a unit and deactivates it with confirmation", async () => {
    stationApi.updateUnit.mockResolvedValue({ success: true });
    stationApi.setUnitActive.mockResolvedValue({ success: true });
    await openUnits();

    const panel = screen.getByLabelText(/Assigned units for/);
    fireEvent.click(within(panel).getAllByText("Edit")[0]);
    fireEvent.change(screen.getByLabelText("Unit Name"), {
      target: { value: "Engine Alpha" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => expect(stationApi.updateUnit).toHaveBeenCalledTimes(1));
    expect(stationApi.updateUnit).toHaveBeenCalledWith("FIRE_BFP_MAIN_STATION", "engine-1", {
      name: "Engine Alpha",
    });

    fireEvent.click(within(panel).getAllByText("Deactivate")[0]);
    expect(stationApi.setUnitActive).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByText("Confirm deactivate"));

    await waitFor(() => expect(stationApi.setUnitActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setUnitActive).toHaveBeenCalledWith(
      "FIRE_BFP_MAIN_STATION",
      "engine-1",
      false,
    );
  });
});
