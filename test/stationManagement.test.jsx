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
  it("creates a station through the Add Station modal (no reauth on create)", async () => {
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

  it("sends a station edit only after the admin re-proves their OWN password", async () => {
    stationApi.updateStation.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Edit")[0]);
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Renamed Fire Station" } });
    expect(screen.queryByLabelText("Station ID")).toBeNull();

    // Save opens the verification step — nothing PATCHed yet.
    fireEvent.click(screen.getByText("Save Changes"));
    const dialogs = screen.getAllByRole("dialog");
    const verify = dialogs[dialogs.length - 1];
    expect(verify.getAttribute("aria-label")).toBe("Verify Admin Password");
    expect(stationApi.updateStation).not.toHaveBeenCalled();

    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(within(verify).getByText("Save Changes"));

    await waitFor(() => expect(stationApi.updateStation).toHaveBeenCalledTimes(1));
    const [id, payload] = stationApi.updateStation.mock.calls[0];
    expect(id).toBe("FIRE_BFP_MAIN_STATION");
    expect(payload.name).toBe("Renamed Fire Station");
    expect(payload).not.toHaveProperty("id");
    expect(payload.adminPassword).toBe("AdminPass!xK9pQ2");
    expect(await screen.findByText("Station updated.")).toBeTruthy();
  });

  it("keeps the verification dialog open on a wrong admin password", async () => {
    stationApi.updateStation.mockRejectedValueOnce({
      response: { data: { message: "Administrator password is incorrect." } },
    });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Edit")[0]);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Renamed Fire Station" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    let verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: "WrongPass!123" },
    });
    fireEvent.click(within(verify).getByText("Save Changes"));

    expect(
      await screen.findByText("Administrator password is incorrect."),
    ).toBeTruthy();
    verify = screen.getAllByRole("dialog").at(-1);
    expect(verify.getAttribute("aria-label")).toBe("Verify Admin Password");
    expect(stationApi.updateStation).toHaveBeenCalledTimes(1);
  });

  it("canceling verification returns to the edit modal without calling the API", async () => {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Edit")[0]);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Renamed Fire Station" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.click(within(verify).getByText("Cancel"));

    // Back on the edit modal — values retained, still no PATCH.
    expect(screen.queryByLabelText("Verify Admin Password")).toBeNull();
    expect(screen.getByLabelText("Edit Station")).toBeTruthy();
    expect(screen.getByLabelText("Name").value).toBe("Renamed Fire Station");
    expect(stationApi.updateStation).not.toHaveBeenCalled();
  });

  it("deactivates a station only after admin verification", async () => {
    stationApi.setStationActive.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    const dialogs = screen.getAllByRole("dialog");
    const verify = dialogs[dialogs.length - 1];
    expect(verify.getAttribute("aria-label")).toBe("Deactivate Station");
    // First action only opens the dialog — no PATCH yet.
    expect(stationApi.setStationActive).not.toHaveBeenCalled();

    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(within(verify).getByText("Confirm Deactivate"));

    await waitFor(() => expect(stationApi.setStationActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setStationActive).toHaveBeenCalledWith(
      "FIRE_BFP_MAIN_STATION",
      false,
      { adminPassword: "AdminPass!xK9pQ2" },
    );
    expect(await screen.findByText("Station deactivated.")).toBeTruthy();
  });

  it("keeps the deactivate dialog open on a wrong admin password", async () => {
    stationApi.setStationActive.mockRejectedValueOnce({
      response: { data: { message: "Administrator password is incorrect." } },
    });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: "WrongPass!123" },
    });
    fireEvent.click(within(verify).getByText("Confirm Deactivate"));

    expect(
      await screen.findByText("Administrator password is incorrect."),
    ).toBeTruthy();
    const stillOpen = screen.getAllByRole("dialog").at(-1);
    expect(stillOpen.getAttribute("aria-label")).toBe("Deactivate Station");
    expect(stationApi.setStationActive).toHaveBeenCalledTimes(1);
    // The station is unchanged — still listed as Active.
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
  });

  it("activates an inactive station directly, without a password", async () => {
    stationApi.setStationActive.mockResolvedValue({ success: true });
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getByText("Activate"));

    await waitFor(() => expect(stationApi.setStationActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setStationActive).toHaveBeenCalledWith(
      "FLOOD_RIVER_COMMAND",
      true,
      {},
    );
    expect(screen.queryByLabelText("Deactivate Station")).toBeNull();
  });

  it("keeps station rows to Edit + status actions (no separate Units button)", async () => {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    // Units are managed inside the Edit Station modal now.
    expect(screen.queryByRole("button", { name: "Units" })).toBeNull();
    expect(screen.getAllByText("Edit")).toHaveLength(2); // one per station row
  });
});

describe("StationManagement — assigned units (inside the Edit Station modal)", () => {
  async function openEditWithUnits() {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Edit")[0]); // FIRE station row
    expect(await screen.findByText("BFP Engine Pumper #1")).toBeTruthy();
    return screen.getByLabelText(/Assigned units for/);
  }

  it("lists a station's units with active/inactive badges", async () => {
    const panel = await openEditWithUnits();
    expect(within(panel).getByText("BFP Engine Pumper #2")).toBeTruthy();
    expect(within(panel).getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getAllByText("Inactive").length).toBeGreaterThanOrEqual(1);
  });

  it("normalizes legacy string units in the edit modal", async () => {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Edit")[1]); // FLOOD station row
    // A legacy string unit renders as both its name AND its id.
    expect((await screen.findAllByText("Rescue Boat Unit #1")).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("No units assigned yet.")).toBeNull();
  });

  it("adds a unit from the inline Add Unit form, independent of Save Changes", async () => {
    stationApi.addUnit.mockResolvedValue({ success: true });
    const panel = await openEditWithUnits();

    // Button stays disabled until both fields are filled.
    expect(within(panel).getByRole("button", { name: "Add Unit" }).disabled).toBe(true);
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "engine-9" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Engine Pumper #9" },
    });
    expect(within(panel).getByRole("button", { name: "Add Unit" }).disabled).toBe(false);
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    await waitFor(() => expect(stationApi.addUnit).toHaveBeenCalledTimes(1));
    expect(stationApi.addUnit).toHaveBeenCalledWith("FIRE_BFP_MAIN_STATION", {
      id: "engine-9",
      name: "Engine Pumper #9",
    });
    expect(await screen.findByText("Unit added.")).toBeTruthy();
  });

  it("renames a unit from the nested Edit Unit dialog", async () => {
    stationApi.updateUnit.mockResolvedValue({ success: true });
    const panel = await openEditWithUnits();

    fireEvent.click(within(panel).getAllByText("Edit")[0]);
    const unitDialog = screen.getAllByRole("dialog").at(-1);
    expect(unitDialog.getAttribute("aria-label")).toBe("Edit Unit");

    fireEvent.change(within(unitDialog).getByLabelText("Unit Name"), {
      target: { value: "Engine Alpha" },
    });
    fireEvent.click(within(unitDialog).getByText("Save Changes"));

    await waitFor(() => expect(stationApi.updateUnit).toHaveBeenCalledTimes(1));
    expect(stationApi.updateUnit).toHaveBeenCalledWith(
      "FIRE_BFP_MAIN_STATION",
      "engine-1",
      { name: "Engine Alpha" },
    );
    expect(await screen.findByText("Unit updated.")).toBeTruthy();
  });

  it("deactivates a unit with the inline two-step confirm (no admin password)", async () => {
    stationApi.setUnitActive.mockResolvedValue({ success: true });
    const panel = await openEditWithUnits();

    fireEvent.click(within(panel).getByText("Deactivate"));
    // First click only arms the confirm — no PATCH yet.
    expect(stationApi.setUnitActive).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByText("Confirm deactivate"));

    await waitFor(() => expect(stationApi.setUnitActive).toHaveBeenCalledTimes(1));
    expect(stationApi.setUnitActive).toHaveBeenCalledWith(
      "FIRE_BFP_MAIN_STATION",
      "engine-1",
      false,
    );
    expect(await screen.findByText("Unit deactivated.")).toBeTruthy();
  });

  it("Cancel dismisses the unit deactivate confirm without calling the API", async () => {
    const panel = await openEditWithUnits();

    fireEvent.click(within(panel).getByText("Deactivate"));
    fireEvent.click(within(panel).getByText("Cancel"));

    expect(stationApi.setUnitActive).not.toHaveBeenCalled();
    expect(within(panel).queryByText("Confirm deactivate")).toBeNull();
  });
});
