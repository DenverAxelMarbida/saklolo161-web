import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserManagement from "../src/components/UserManagement";
import Header from "../src/components/Header";

vi.mock("../src/lib/api", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserEnabled: vi.fn(),
  changeOwnPassword: vi.fn(),
}));

import { listUsers, createUser, updateUser, setUserEnabled } from "../src/lib/api";

const STRONG = "Str0ngPass!xK9pQ2";

function makeUser(overrides = {}) {
  return {
    uid: "uid-1",
    email: "admin@marikina.gov.ph",
    agency: "ALL",
    role: "admin",
    disabled: false,
    createdAt: "Mon, 01 Jan 2026 00:00:00 GMT",
    ...overrides,
  };
}

const enabledUser = makeUser();
const disabledUser = makeUser({
  uid: "uid-2",
  email: "fire@marikina.gov.ph",
  agency: "FIRE",
  role: "dispatcher",
  disabled: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserManagement", () => {
  it("1. renders user rows with email, agency, role, and status", async () => {
    listUsers.mockResolvedValue([enabledUser, disabledUser]);

    render(<UserManagement />);

    expect(await screen.findByText("admin@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByText("ALL")).toBeTruthy();
    expect(screen.getByText("FIRE")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getByText("dispatcher")).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("4. the Add User form submits createUser with email, password, agency, role", async () => {
    listUsers.mockResolvedValue([]);
    createUser.mockResolvedValue({ success: true, data: makeUser({ uid: "uid-new" }) });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add User"));

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "new@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Agency"), {
      target: { value: "FLOOD" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "dispatcher" },
    });

    const submit = screen.getByText("Create User");
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        email: "new@marikina.gov.ph",
        password: STRONG,
        agency: "FLOOD",
        role: "dispatcher",
      }),
    );
  });

  it("keeps Create User disabled for a weak password and shows the live checklist", async () => {
    listUsers.mockResolvedValue([]);

    const { container } = render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add User"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret123" },
    });

    expect(screen.getByText("Create User").disabled).toBe(true);
    expect(container.querySelectorAll("li[data-met]").length).toBe(5);
    expect(
      container.querySelector('li[data-met="false"]'),
    ).toBeTruthy();
  });

  it("keeps Create User disabled until Confirm Password matches", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add User"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Mismatched!Pass1" },
    });

    expect(screen.getByText("Create User").disabled).toBe(true);
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: STRONG },
    });
    expect(screen.getByText("Create User").disabled).toBe(false);
  });

  it("5. Edit opens the form pre-filled with the existing user data (no password field)", async () => {
    listUsers.mockResolvedValue([enabledUser]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Edit"));

    expect(screen.getByLabelText("Email").value).toBe("admin@marikina.gov.ph");
    expect(screen.getByLabelText("Agency").value).toBe("ALL");
    expect(screen.getByLabelText("Role").value).toBe("admin");
    // Edit must never ask for or expose a password.
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("6. Edit submits updateUser with the changed fields", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    updateUser.mockResolvedValue({ success: true, data: enabledUser });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(screen.getByLabelText("Agency"), {
      target: { value: "MEDICAL" },
    });
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith("uid-1", {
        email: "admin@marikina.gov.ph",
        agency: "MEDICAL",
        role: "admin",
      }),
    );
  });

  it("7. Disable asks for confirmation, then calls setUserEnabled(uid, false)", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    setUserEnabled.mockResolvedValue({ success: true, data: enabledUser });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Disable"));

    // No API call before the admin confirms.
    expect(setUserEnabled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Confirm disable"));

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("uid-1", false),
    );
  });

  it("8. Enable calls setUserEnabled(uid, true)", async () => {
    listUsers.mockResolvedValue([disabledUser]);
    setUserEnabled.mockResolvedValue({ success: true, data: disabledUser });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Enable"));

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("uid-2", true),
    );
  });

  it("9. no password input or password value appears in the user list", async () => {
    listUsers.mockResolvedValue([enabledUser, disabledUser]);

    const { container } = render(<UserManagement />);

    await screen.findByText("admin@marikina.gov.ph");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("10. renders an error state when the user list fails to load", async () => {
    listUsers.mockRejectedValue(new Error("network down"));

    render(<UserManagement />);

    expect(await screen.findByText(/couldn't load users/i)).toBeTruthy();
    expect(screen.queryByText("admin@marikina.gov.ph")).toBeNull();
  });

  it("renders an empty state when there are no users", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);

    expect(await screen.findByText("No users found.")).toBeTruthy();
  });
});

describe("Header admin navigation", () => {
  it("2. shows the User Management control for an admin and navigates on click", () => {
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

    const nav = screen.getByText("User Management");
    fireEvent.click(nav);
    expect(onNavigate).toHaveBeenCalledWith("users");
  });

  it("3. hides the User Management control from non-admins", () => {
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        role="dispatcher"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.queryByText("User Management")).toBeNull();
    // The rest of the header keeps working for dispatchers.
    expect(screen.getByText("Logout")).toBeTruthy();
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
  });

  it("shows the Control Room control (back) for an admin on the users view", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        role="admin"
        view="users"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    expect(screen.queryByText("User Management")).toBeNull();
    const back = screen.getByText("Control Room");
    fireEvent.click(back);
    expect(onNavigate).toHaveBeenCalledWith("control");
  });
});
