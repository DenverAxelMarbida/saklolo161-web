import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../src/App";
import Header from "../src/components/Header";
import Settings from "../src/components/Settings";

// ---- App-level mocks (hoisted above imports by vitest) --------------------

const { authState, pollState } = vi.hoisted(() => ({
  authState: { payload: null },
  // Mutable so the view-switching test can give the Control Room some
  // App-level polling state to carry across a Settings round-trip.
  pollState: { incidents: [] },
}));

vi.mock("../src/lib/auth", () => ({
  onAuthChange: (callback) => {
    callback(authState.payload);
    return () => {};
  },
  onAuthRestore: (callback) => {
    callback();
    return () => {};
  },
  logout: vi.fn(),
  login: vi.fn(),
  getStoredAuth: vi.fn(() => authState.payload),
}));

vi.mock("../src/hooks/useIncidentPolling", () => ({
  useIncidentPolling: () => ({
    incidents: pollState.incidents,
    refresh: vi.fn(),
    newIncidentIds: [],
  }),
}));

// ControlRoom (and its map/queue children) isn't what these tests cover —
// its behavior belongs to its own component tests. A marker div that
// echoes the incidents prop is enough to prove App's view-switching
// rendered the right screen AND that App-level polling state survived a
// Settings round-trip.
vi.mock("../src/components/ControlRoom", () => ({
  default: ({ incidents = [] }) => (
    <div data-testid="control-room">
      {incidents.map((incident) => (
        <span key={incident.id}>{incident.refNo}</span>
      ))}
    </div>
  ),
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
  pollState.incidents = [];
  listUsers.mockResolvedValue([]);
  authState.payload = { token: "test-token", user: dispatcherUser };
});

describe("Header — Settings gear button", () => {
  it("is visible for a dispatcher with an accessible name, without disturbing existing controls", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        view="control"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    const gear = screen.getByLabelText("Settings");
    expect(gear.getAttribute("title")).toBe("Settings");

    // Existing header functionality intact + new branding.
    expect(screen.getByText("Logout")).toBeTruthy();
    expect(screen.getByText("Saklolo 161")).toBeTruthy();
    expect(screen.getByText("Marikina City DRRMO")).toBeTruthy();
    expect(screen.queryByText("Marikina City MDRRMO")).toBeNull();

    // Redundant controls are gone from the header — Settings is the single
    // entry point for both (asserted below, not duplicated here).
    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();

    fireEvent.click(gear);
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("no longer ships the dead search input — branding, Settings, chip, and Logout stand alone", () => {
    const { container } = render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    // The non-functional search box is gone entirely (no replacement
    // control took its place).
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(screen.queryByPlaceholderText(/Search by ref/)).toBeNull();
    expect(container.querySelector("input")).toBeNull();

    // Everything else survives the removal.
    expect(screen.getByText("Saklolo 161")).toBeTruthy();
    expect(screen.getByText("Marikina City DRRMO")).toBeTruthy();
    expect(screen.getByLabelText("Settings")).toBeTruthy();
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("is visible for an admin without reintroducing the old admin/password buttons", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        view="control"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
    expect(screen.queryByText("User Management")).toBeNull();
    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("marks itself as the current section on the settings view", () => {
    const { rerender } = render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
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

  it("admin gets a User Management tab inside Settings that opens the existing component inline", async () => {
    const onNavigate = vi.fn();
    render(<Settings user={adminUser} onNavigate={onNavigate} />);

    // The section is reachable as a Settings tab — no card, no redirect.
    expect(screen.getByRole("tab", { name: "My Account" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "User Management" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My Account" })).toBeTruthy();
    expect(screen.queryByText("Add User")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "User Management" }));

    // The EXISTING UserManagement component renders inside Settings.
    expect(await screen.findByText("Add User")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "User Management" }),
    ).toBeTruthy();
    // Stays in Settings — never navigates to a separate view.
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText("Back to Control Room")).toBeTruthy();
  });

  it("admin: initialSection=\"users\" opens Settings directly on the User Management tab", async () => {
    render(
      <Settings user={adminUser} onNavigate={() => {}} initialSection="users" />,
    );

    expect(
      screen.getByRole("tab", { name: "User Management" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(await screen.findByText("Add User")).toBeTruthy();
  });

  it("dispatcher does NOT see any User Management option", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <Settings user={dispatcherUser} onNavigate={onNavigate} />,
    );

    expect(screen.queryByRole("tab", { name: "User Management" })).toBeNull();
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

  it("Settings round-trip keeps App-level state intact and runs the view cross-fade", () => {
    // Give the Control Room App-level polling state to carry.
    pollState.incidents = [
      { id: "inc-1", refNo: "INC-0001" },
      { id: "inc-2", refNo: "INC-0002" },
    ];
    render(<App />);

    // Control Room: shell carries the transition class, incidents visible.
    let main = screen.getByRole("main");
    expect(main.classList.contains("animate-view-in")).toBe(true);
    expect(screen.getByText("INC-0001")).toBeTruthy();
    expect(screen.getByText("INC-0002")).toBeTruthy();

    // Control Room -> Settings.
    fireEvent.click(screen.getByLabelText("Settings"));
    main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(main.classList.contains("animate-view-in")).toBe(true);
    expect(screen.queryByText("INC-0001")).toBeNull();

    // Settings -> Control Room: the same App-level state comes back —
    // navigation must not reset the polling data behind the view.
    fireEvent.click(within(main).getByText("Back to Control Room"));
    expect(screen.getByTestId("control-room")).toBeTruthy();
    expect(screen.getByText("INC-0001")).toBeTruthy();
    expect(screen.getByText("INC-0002")).toBeTruthy();
    expect(screen.getByRole("main").classList.contains("animate-view-in")).toBe(true);
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

  it("admin: gear to Settings -> User Management tab inline -> Back to Control Room", async () => {
    authState.payload = { token: "test-token", user: adminUser };
    render(<App />);

    fireEvent.click(screen.getByLabelText("Settings"));

    let main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(within(main).getByText("admin@marikina.gov.ph")).toBeTruthy();
    expect(within(main).getByRole("tab", { name: "User Management" })).toBeTruthy();

    // Switching tabs opens the EXISTING UserManagement component INSIDE
    // Settings — no separate view, no redirect.
    fireEvent.click(within(main).getByRole("tab", { name: "User Management" }));
    expect(await within(main).findByText("Add User")).toBeTruthy();
    expect(
      within(main).getByRole("heading", { name: "Settings" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("control-room")).toBeNull();

    // Settings -> Control Room, straight from the integrated section.
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

describe("View transition — CSS contract", () => {
  // jsdom doesn't execute stylesheets, so the animation's properties are
  // verified at the source: fast, opacity-only, reduced-motion aware.
  // (import.meta.url isn't a file: URL under the jsdom environment, so
  // resolve from the project root instead.)
  const css = readFileSync("src/index.css", "utf8");

  it("cross-fades views with a fast, opacity-only keyframe", () => {
    const kfIndex = css.indexOf("@keyframes sak-view-in");
    expect(kfIndex).toBeGreaterThan(-1);
    const keyframes = css.slice(kfIndex, css.indexOf("\n}", kfIndex));
    expect(keyframes).toContain("opacity: 0");
    expect(keyframes).toContain("opacity: 1");
    expect(keyframes).not.toContain("transform");

    const classMatch = css.match(/\.animate-view-in\s*\{[^}]*\}/);
    expect(classMatch).toBeTruthy();
    expect(classMatch[0]).toMatch(/animation:\s*sak-view-in\s+0\.18s\s+ease-out/);
  });

  it("keeps modal/status entrance animations inside the 150–250ms band", () => {
    const popIn = css.match(/\.animate-pop-in\s*\{[^}]*\}/);
    expect(popIn).toBeTruthy();
    expect(popIn[0]).toMatch(/animation:\s*sak-pop-in\s+0\.2s\s+ease-out/);

    const slideUp = css.match(/\.animate-slide-up\s*\{[^}]*\}/);
    expect(slideUp).toBeTruthy();
    expect(slideUp[0]).toMatch(/animation:\s*sak-slide-up\s+0\.25s\s+ease-out/);
  });

  it("is disabled under prefers-reduced-motion", () => {
    const rmIndex = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(rmIndex).toBeGreaterThan(-1);
    const reducedMotion = css.slice(rmIndex, css.indexOf("\n}", rmIndex));
    expect(reducedMotion).toContain(".animate-view-in");
    expect(reducedMotion).toContain("animation: none");
  });
});
