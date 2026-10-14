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
  async function verifyAndConfirm(password, confirmLabel = "Save Changes") {
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: password },
    });
    fireEvent.click(within(verify).getByText(confirmLabel));
  }

  async function openAddStationFilled() {
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
  }

  it("the Add Station modal contains an Assigned Units section with a draft add form", async () => {
    await openAddStationFilled();

    const panel = screen.getByLabelText(/Assigned units for new station/);
    expect(within(panel).getByLabelText("New Unit ID")).toBeTruthy();
    expect(within(panel).getByLabelText("New Unit Name")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Add Unit" }).disabled).toBe(true);
  });

  it("rejects creation with zero assigned units — modal stays open, no API", async () => {
    await openAddStationFilled();

    fireEvent.click(screen.getByText("Create Station"));

    expect(
      await screen.findByText("Add at least one assigned unit before creating the station."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Add Station")).toBeTruthy(); // still open
    expect(stationApi.createStation).not.toHaveBeenCalled();
    // Not even the password prompt yet — validation runs first.
    expect(screen.queryByLabelText("Verify Admin Password")).toBeNull();
  });

  it("adds initial units to the draft only — no mutation request", async () => {
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);

    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    expect(stationApi.createStation).not.toHaveBeenCalled();
    expect(within(panel).getByText("Ambulance 1")).toBeTruthy();
    expect(within(panel).getByText("New")).toBeTruthy();
  });

  it("rejects duplicate or invalid unit ids in the creation draft", async () => {
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);

    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "bad/id" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Broken" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));
    expect(await screen.findByText(/must not contain/)).toBeTruthy();
    expect(within(panel).queryByText("Broken")).toBeNull();

    // Valid add, then a duplicate id attempt.
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Impostor" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));
    expect(await screen.findByText(/already exists in this station/)).toBeTruthy();
    expect(within(panel).queryByText("Impostor")).toBeNull();
    expect(stationApi.createStation).not.toHaveBeenCalled();
  });

  it("creating a station asks for the admin password and sends ONE request with units + password", async () => {
    stationApi.createStation.mockResolvedValue({ success: true });
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);

    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    fireEvent.click(screen.getByText("Create Station"));
    // Verification opens before ANY request.
    const verify = screen.getAllByRole("dialog").at(-1);
    expect(verify.getAttribute("aria-label")).toBe("Verify Admin Password");
    expect(verify.textContent).toContain("Confirm Station Creation");
    expect(stationApi.createStation).not.toHaveBeenCalled();

    await verifyAndConfirm("AdminPass!xK9pQ2", "Create Station");

    await waitFor(() => expect(stationApi.createStation).toHaveBeenCalledTimes(1));
    expect(stationApi.createStation).toHaveBeenCalledWith({
      id: "MEDICAL_TEST_BASE",
      name: "Test Medical Base",
      category: "Medical",
      phone: "",
      coords: null,
      estimatedTurnout: "",
      assignedUnits: [{ id: "amb-1", name: "Ambulance 1" }],
      adminPassword: "AdminPass!xK9pQ2",
    });
    expect(await screen.findByText("Station created.")).toBeTruthy();
    expect(screen.queryByLabelText("Add Station")).toBeNull();
    // Data refreshed after success.
    expect(stationApi.listStations).toHaveBeenCalledTimes(2);
  });

  it("canceling the password prompt creates neither a station nor any units", async () => {
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    fireEvent.click(screen.getByText("Create Station"));
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.click(within(verify).getByText("Cancel"));

    expect(stationApi.createStation).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Add Station")).toBeTruthy();
    // Draft intact for a corrected retry.
    expect(within(panel).getByText("Ambulance 1")).toBeTruthy();
  });

  it("incorrect admin credentials create neither a station nor any units", async () => {
    stationApi.createStation.mockRejectedValueOnce({
      response: { data: { message: "Administrator password is incorrect." } },
    });
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    fireEvent.click(screen.getByText("Create Station"));
    await verifyAndConfirm("WrongPass!123", "Create Station");

    expect(
      await screen.findByText("Administrator password is incorrect."),
    ).toBeTruthy();
    // Single request attempted and rejected — nothing persisted,
    // verify dialog stays for a corrected retry.
    expect(stationApi.createStation).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Station created.")).toBeNull();
    expect(
      screen.getAllByRole("dialog").at(-1).getAttribute("aria-label"),
    ).toBe("Verify Admin Password");
  });

  it("surfaces backend validation errors inside the verification dialog without closing the modal", async () => {
    stationApi.createStation.mockRejectedValueOnce({
      response: { data: { message: "Station X already exists." } },
    });
    await openAddStationFilled();
    const panel = screen.getByLabelText(/Assigned units for new station/);
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: "amb-1" },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: "Ambulance 1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));

    fireEvent.click(screen.getByText("Create Station"));
    await verifyAndConfirm("AdminPass!xK9pQ2", "Create Station");

    expect(await screen.findByText("Station X already exists.")).toBeTruthy();
    expect(screen.queryByText("Station created.")).toBeNull();
    expect(stationApi.createStation).toHaveBeenCalledTimes(1);
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
    // Untouched draft units trigger no unit requests.
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(stationApi.addUnit).not.toHaveBeenCalled();
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

describe("StationManagement — assigned units (pending draft inside the Edit Station modal)", () => {
  async function openEditWithUnits() {
    render(<StationManagement embedded />);
    expect(await screen.findByText("River Park Authority")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Edit")[0]); // FIRE station row
    expect(await screen.findByText("BFP Engine Pumper #1")).toBeTruthy();
    return screen.getByLabelText(/Assigned units for/);
  }

  async function draftRename(panel, newName) {
    fireEvent.click(within(panel).getAllByText("Edit")[0]);
    const unitDialog = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(unitDialog).getByLabelText("Unit Name"), {
      target: { value: newName },
    });
    fireEvent.click(within(unitDialog).getByText("Save Changes"));
  }

  async function draftAdd(panel, id, name) {
    fireEvent.change(within(panel).getByLabelText("New Unit ID"), {
      target: { value: id },
    });
    fireEvent.change(within(panel).getByLabelText("New Unit Name"), {
      target: { value: name },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Add Unit" }));
  }

  async function verifyAndConfirm(password) {
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(verify).getByLabelText("Your Current Password"), {
      target: { value: password },
    });
    fireEvent.click(within(verify).getByText("Save Changes"));
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

  it("Add Unit appends to the pending draft WITHOUT any API mutation", async () => {
    const panel = await openEditWithUnits();

    expect(within(panel).getByRole("button", { name: "Add Unit" }).disabled).toBe(true);
    await draftAdd(panel, "engine-9", "Engine Pumper #9");

    // Draft-only: no POST, no reload, marked as New.
    expect(stationApi.addUnit).not.toHaveBeenCalled();
    expect(stationApi.listStations).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText("Engine Pumper #9")).toBeTruthy();
    expect(within(panel).getByText("New")).toBeTruthy();
    // Inline inputs cleared for the next add.
    expect(within(panel).getByLabelText("New Unit ID").value).toBe("");
    expect(within(panel).getByLabelText("New Unit Name").value).toBe("");
  });

  it("rejects a duplicate unit ID in the draft without touching the API", async () => {
    const panel = await openEditWithUnits();

    await draftAdd(panel, "engine-1", "Impostor Engine");

    expect(await screen.findByText(/already exists in this station/)).toBeTruthy();
    expect(stationApi.addUnit).not.toHaveBeenCalled();
    // No draft entry was created.
    expect(within(panel).queryByText("Impostor Engine")).toBeNull();
  });

  it("renaming a unit updates only the draft (Unsaved badge, no API call)", async () => {
    const panel = await openEditWithUnits();

    await draftRename(panel, "Engine Alpha");

    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(within(panel).getByText("Engine Alpha")).toBeTruthy();
    expect(within(panel).getByText("Unsaved")).toBeTruthy();
    // Original name is gone from the row.
    expect(within(panel).queryByText("BFP Engine Pumper #1")).toBeNull();
  });

  it("an empty rename is rejected in the unit dialog and leaves the draft unchanged", async () => {
    const panel = await openEditWithUnits();

    fireEvent.click(within(panel).getAllByText("Edit")[0]);
    const unitDialog = screen.getAllByRole("dialog").at(-1);
    fireEvent.change(within(unitDialog).getByLabelText("Unit Name"), {
      target: { value: "   " },
    });
    fireEvent.click(within(unitDialog).getByText("Save Changes"));

    expect(await within(unitDialog).findByText("Unit name is required.")).toBeTruthy();
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(within(panel).getByText("BFP Engine Pumper #1")).toBeTruthy();
  });

  it("Remove discards a pending add without any API call", async () => {
    const panel = await openEditWithUnits();
    await draftAdd(panel, "engine-9", "Engine Pumper #9");
    expect(within(panel).getByText("Engine Pumper #9")).toBeTruthy();

    fireEvent.click(within(panel).getByText("Remove"));

    expect(within(panel).queryByText("Engine Pumper #9")).toBeNull();
    expect(stationApi.addUnit).not.toHaveBeenCalled();
  });

  it("Save Changes commits station + pending units after ONE reauth, station PATCH first", async () => {
    stationApi.updateStation.mockResolvedValue({ success: true });
    stationApi.updateUnit.mockResolvedValue({ success: true });
    stationApi.addUnit.mockResolvedValue({ success: true });
    const panel = await openEditWithUnits();

    await draftRename(panel, "Engine Alpha");
    await draftAdd(panel, "engine-9", "Engine Pumper #9");

    fireEvent.click(screen.getByText("Save Changes"));
    // Verification opens before ANY mutation.
    expect(
      screen.getAllByRole("dialog").at(-1).getAttribute("aria-label"),
    ).toBe("Verify Admin Password");
    expect(stationApi.updateStation).not.toHaveBeenCalled();
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(stationApi.addUnit).not.toHaveBeenCalled();

    await verifyAndConfirm("AdminPass!xK9pQ2");

    expect(await screen.findByText("Station updated.")).toBeTruthy();
    expect(screen.queryByLabelText("Edit Station")).toBeNull();
    expect(stationApi.updateStation).toHaveBeenCalledTimes(1);
    expect(stationApi.updateUnit).toHaveBeenCalledWith(
      "FIRE_BFP_MAIN_STATION",
      "engine-1",
      { name: "Engine Alpha" },
    );
    expect(stationApi.addUnit).toHaveBeenCalledWith("FIRE_BFP_MAIN_STATION", {
      id: "engine-9",
      name: "Engine Pumper #9",
    });
    // The reauth-carrying station PATCH always runs before unit ops.
    expect(stationApi.updateStation.mock.invocationCallOrder[0]).toBeLessThan(
      stationApi.updateUnit.mock.invocationCallOrder[0],
    );
    expect(stationApi.updateUnit.mock.invocationCallOrder[0]).toBeLessThan(
      stationApi.addUnit.mock.invocationCallOrder[0],
    );
  });

  it("an incorrect admin password persists NOTHING (no station or unit requests)", async () => {
    stationApi.updateStation.mockRejectedValueOnce({
      response: { data: { message: "Administrator password is incorrect." } },
    });
    const panel = await openEditWithUnits();
    await draftRename(panel, "Engine Alpha");
    await draftAdd(panel, "engine-9", "Engine Pumper #9");

    fireEvent.click(screen.getByText("Save Changes"));
    await verifyAndConfirm("WrongPass!123");

    expect(
      await screen.findByText("Administrator password is incorrect."),
    ).toBeTruthy();
    expect(stationApi.updateStation).toHaveBeenCalledTimes(1);
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(stationApi.addUnit).not.toHaveBeenCalled();

    // Back on the edit modal, the draft is fully intact.
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.click(within(verify).getByText("Cancel"));
    expect(within(panel).getByText("Engine Alpha")).toBeTruthy();
    expect(within(panel).getByText("Unsaved")).toBeTruthy();
    expect(within(panel).getByText("Engine Pumper #9")).toBeTruthy();
  });

  it("canceling verification persists nothing and keeps the draft", async () => {
    const panel = await openEditWithUnits();
    await draftRename(panel, "Engine Alpha");
    await draftAdd(panel, "engine-9", "Engine Pumper #9");

    fireEvent.click(screen.getByText("Save Changes"));
    const verify = screen.getAllByRole("dialog").at(-1);
    fireEvent.click(within(verify).getByText("Cancel"));

    expect(stationApi.updateStation).not.toHaveBeenCalled();
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(stationApi.addUnit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Edit Station")).toBeTruthy();
    expect(within(panel).getByText("Engine Alpha")).toBeTruthy();
    expect(within(panel).getByText("Engine Pumper #9")).toBeTruthy();
  });

  it("a partial failure keeps the modal open, reconciles the draft, and retries without duplicating", async () => {
    // Refresh after the partial failure: the rename landed server-side,
    // the add did NOT. Refresh after the retry: the add landed too.
    const REFRESHED = structuredClone(STATIONS);
    REFRESHED[0].assignedUnits[0].name = "Engine Alpha";
    const RETRIED = structuredClone(REFRESHED);
    RETRIED[0].assignedUnits.push({
      id: "engine-9",
      name: "Engine Pumper #9",
      isActive: true,
    });

    stationApi.updateStation.mockResolvedValue({ success: true });
    stationApi.updateUnit.mockResolvedValue({ success: true });
    stationApi.addUnit
      .mockRejectedValueOnce({
        response: {
          data: { message: "Station store write failed. Changes were NOT saved." },
        },
      })
      .mockResolvedValueOnce({ success: true });

    const panel = await openEditWithUnits();
    await draftRename(panel, "Engine Alpha");
    await draftAdd(panel, "engine-9", "Engine Pumper #9");

    // First save: station + rename succeed, add fails.
    stationApi.listStations.mockResolvedValueOnce(REFRESHED);
    fireEvent.click(screen.getByText("Save Changes"));
    await verifyAndConfirm("AdminPass!xK9pQ2");

    // Accurate partial report — NOT full success, modal stays open.
    expect(
      (await screen.findAllByText(/some unit changes failed/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Edit Station")).toBeTruthy();
    expect(screen.queryByLabelText("Verify Admin Password")).toBeNull();
    expect(screen.queryByText("Station updated.")).toBeNull();
    expect(stationApi.updateStation).toHaveBeenCalledTimes(1);
    expect(stationApi.updateUnit).toHaveBeenCalledTimes(1);
    expect(stationApi.addUnit).toHaveBeenCalledTimes(1);

    // Draft reconciled against the refreshed server data: the rename
    // is clean (no Unsaved), the failed add is still pending (New).
    expect(within(panel).queryByText("Unsaved")).toBeNull();
    expect(within(panel).getByText("Engine Alpha")).toBeTruthy();
    expect(within(panel).getByText("Engine Pumper #9")).toBeTruthy();
    expect(within(panel).getByText("New")).toBeTruthy();

    // Retry: only the still-missing unit op is re-sent — the landed
    // rename is never duplicated, and engine-9 is added exactly once
    // more (same id, single request).
    stationApi.listStations.mockResolvedValueOnce(RETRIED);
    fireEvent.click(screen.getByText("Save Changes"));
    await verifyAndConfirm("AdminPass!xK9pQ2");

    expect(await screen.findByText("Station updated.")).toBeTruthy();
    expect(screen.queryByLabelText("Edit Station")).toBeNull();
    expect(stationApi.updateStation).toHaveBeenCalledTimes(2);
    expect(stationApi.updateUnit).toHaveBeenCalledTimes(1); // NOT re-sent
    expect(stationApi.addUnit).toHaveBeenCalledTimes(2);
    expect(stationApi.addUnit).toHaveBeenLastCalledWith(
      "FIRE_BFP_MAIN_STATION",
      { id: "engine-9", name: "Engine Pumper #9" },
    );
  });

  it("Cancel discards all pending station and unit edits without sending anything", async () => {
    const panel = await openEditWithUnits();
    await draftRename(panel, "Engine Alpha");
    await draftAdd(panel, "engine-9", "Engine Pumper #9");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Renamed Fire Station" },
    });

    // Close via the edit modal's Cancel (topmost dialog is the edit
    // modal — no verify/unit dialog is open).
    fireEvent.click(within(screen.getByLabelText("Edit Station")).getByText("Cancel"));

    expect(stationApi.updateStation).not.toHaveBeenCalled();
    expect(stationApi.updateUnit).not.toHaveBeenCalled();
    expect(stationApi.addUnit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Edit Station")).toBeNull();

    // Reopening starts from clean server state, not the discarded draft.
    fireEvent.click(screen.getAllByText("Edit")[0]);
    expect(screen.getByText("BFP Engine Pumper #1")).toBeTruthy();
    expect(screen.queryByText("Engine Alpha")).toBeNull();
    expect(screen.queryByText("Engine Pumper #9")).toBeNull();
    expect(
      within(screen.getByLabelText(/Assigned units for/)).queryByText("Unsaved"),
    ).toBeNull();
  });

  it("deactivates a unit with the inline two-step confirm (no admin password, immediate)", async () => {
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
