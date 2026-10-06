import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../src/App";
import Header from "../src/components/Header";
import Settings from "../src/components/Settings";

// ---- App-level mocks (hoisted above imports by vitest) --------------------

const { authState } = vi.hoisted(() => ({ authState: { payload: null } }));

vi.mock("../src/lib/auth", () => ({
  onAuthChange: (callback) => {
    callback(authState.payload);
    return () => {};
  },
  logout: vi.fn(),
  login: vi.fn(),
  getStoredAuth: vi.fn(() => authState.payload),
}));

vi.mock("../src/hooks/useIncidentPolling", () => ({
  useIncidentPolling: () => ({
    incidents: [],
    refresh: vi.fn(),
    newIncidentIds: [],
  }),
}));

// ControlRoom (and its map/queue children) isn't what these tests cover —
// its behavior belongs to its own component tests. A marker div is enough
// to prove App's view-switching rendered the right screen.
vi.mock("../src/components/ControlRoom", () => ({
  default: () => <div data-testid="control-room" />,
}));

vi.mock("../src/lib/api", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserEnabled: vi.fn(),
  changeOwnPassword: vi.fn(),
}));

// TriageModal/DispatchTracker import map modules at load time; they never
// render in these tests, but the import must not touch real mapbox-gl.
vi.mock("mapbox-gl", () => ({ default: { accessToken: "" } }));

import { listUsers } from "../src/lib/api";

const dispatcherUser = {
  uid: "uid-fire",
  email: "fire@marikina.gov.ph",
  agency: "FIRE",
  role: "dispatcher",
};
const adminUser = {
  uid: "uid-admin",
  email: "admin@marikina.gov.ph",
  agency: "ALL",
  role: "admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  listUsers.mockResolvedValue([]);
  authState.payload = { token: "test-token", user: dispatcherUser };
});

describe("Header — Settings gear button", () => {
  it("is visible for a dispatcher with an accessible name, without disturbing existing controls", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        role="dispatcher"
        view="control"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    const gear = screen.getByLabelText("Settings");
    expect(gear.getAttribute("title")).toBe("Settings");

    // Existing header functionality intact.
    expect(screen.getByText("Logout")).toBeTruthy();
    expect(screen.getByText("Change Password")).toBeTruthy();
    expect(screen.getByText("SAKLOLO 161")).toBeTruthy();

    fireEvent.click(gear);
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("is visible for an admin alongside the existing admin controls", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        role="admin"
        view="control"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
    expect(screen.getByText("User Management")).toBeTruthy();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("marks itself as the current section on the settings view", () => {
    const { rerender } = render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        role="dispatcher"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );
    expect(
      screen.getByLabelText("Settings").getAttribute("aria-current"),
    ).toBeNull();

    rerender(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        role="dispatcher"
        view="settings"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );
    expect(
      screen.getByLabelText("Settings").getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("Settings view", () => {
  it("shows the page title, subtitle, and Back to Control Room navigates to the control room", () => {
    const onNavigate = vi.fn();
    render(<Settings user={dispatcherUser} onNavigate={onNavigate} />);

    expect(
      screen.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeTruthy();
    expect(
      screen.getByText("Manage your account and control-room access."),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Back to Control Room"));
    expect(onNavigate).toHaveBeenCalledWith("control");
  });

  it("displays the signed-in account's email, agency, and role", () => {
    render(<Settings user={adminUser} onNavigate={() => {}} />);

    expect(screen.getByText("admin@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByText("ALL")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My Account" })).toBeTruthy();
  });

  it("offers Change Password and opens the existing modal (admin and dispatcher alike)", () => {
    const { unmount } = render(<Settings user={adminUser} onNavigate={() => {}} />);

    fireEvent.click(screen.getByText("Change Password"));
    expect(screen.getByLabelText("Current Password")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("Current Password")).toBeNull();
    unmount();

    render(<Settings user={dispatcherUser} onNavigate={() => {}} />);
    fireEvent.click(screen.getByText("Change Password"));
    expect(screen.getByLabelText("Current Password")).toBeTruthy();
  });

  it("admin sees the User Management card with its description and opens the existing view", () => {
    const onNavigate = vi.fn();
    render(<Settings user={adminUser} onNavigate={onNavigate} />);

    expect(screen.getByRole("heading", { name: "User Management" })).toBeTruthy();
    expect(
      screen.getByText(
        "Manage dispatcher and administrator accounts, roles, agencies, and account status.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Open User Management"));
    expect(onNavigate).toHaveBeenCalledWith("users");
  });

  it("dispatcher does NOT see any User Management option", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Settings user={dispatcherUser} onNavigate={onNavigate} />,
    );

    expect(within(container).queryByText("User Management")).toBeNull();
    expect(within(container).queryByText("Open User Management")).toBeNull();
    expect(onNavigate).not.toHaveBeenCalledWith("users");
  });
});

describe("App — Settings view switching", () => {
  it("dispatcher: Settings button opens the Settings view, Back returns to the Control Room", () => {
    render(<App />);

    expect(screen.getByTestId("control-room")).toBeTruthy();
    expect(screen.getByLabelText("Settings")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Settings"));

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(
      within(main).getByText("Manage your account and control-room access."),
    ).toBeTruthy();
    expect(within(main).getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(within(main).getByText("FIRE")).toBeTruthy();
    expect(within(main).getByText("dispatcher")).toBeTruthy();
    expect(screen.queryByTestId("control-room")).toBeNull();

    fireEvent.click(within(main).getByText("Back to Control Room"));

    expect(screen.getByTestId("control-room")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
  });

  it("dispatcher: no User Management entry point anywhere in Settings", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Settings"));

    const main = screen.getByRole("main");
    expect(within(main).queryByText("User Management")).toBeNull();
    expect(within(main).queryByText("Open User Management")).toBeNull();
    // The header only offers admin controls to admins.
    expect(screen.queryByText("User Management")).toBeNull();
  });

  it("admin: Settings -> User Management -> gear back to Settings -> Control Room", async () => {
    authState.payload = { token: "test-token", user: adminUser };
    render(<App />);

    fireEvent.click(screen.getByLabelText("Settings"));

    let main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "User Management" })).toBeTruthy();
    expect(
      within(main).getByText(
        "Manage dispatcher and administrator accounts, roles, agencies, and account status.",
      ),
    ).toBeTruthy();
    expect(within(main).getByText("admin@marikina.gov.ph")).toBeTruthy();

    // Settings -> User Management opens the EXISTING view.
    fireEvent.click(within(main).getByText("Open User Management"));
    expect(await screen.findByText("Add User")).toBeTruthy();
    expect(screen.queryByTestId("control-room")).toBeNull();

    // User Management -> Settings via the header gear.
    fireEvent.click(screen.getByLabelText("Settings"));
    main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Settings" })).toBeTruthy();

    // Settings -> Control Room.
    fireEvent.click(within(main).getByText("Back to Control Room"));
    expect(await screen.findByTestId("control-room")).toBeTruthy();
  });

  it("admin: Change Password action is available from Settings", () => {
    authState.payload = { token: "test-token", user: adminUser };
    render(<App />);
    fireEvent.click(screen.getByLabelText("Settings"));

    const main = screen.getByRole("main");
    fireEvent.click(within(main).getByText("Change Password"));

    expect(screen.getByLabelText("Current Password")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByLabelText("Current Password")).toBeNull();
  });
});
