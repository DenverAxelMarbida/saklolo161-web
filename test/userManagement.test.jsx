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

describe("UserManagement — loading skeleton and pending toggles", () => {
  it("shows a skeleton region instead of a bare 'Loading users…' placeholder", async () => {
    listUsers.mockImplementation(() => new Promise(() => {}));

    render(<UserManagement />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toMatch(/loading users/i);
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText(/loading users/i)).toBeNull();
    expect(screen.queryByText("No users found.")).toBeNull();
  });

  it("keeps the rows on screen during a background refetch (no skeleton flash)", async () => {
    listUsers
      .mockResolvedValueOnce([disabledUser])
      .mockImplementation(() => new Promise(() => {}));
    setUserEnabled.mockResolvedValue({ success: true });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Enable"));

    // listUsers' second call hangs — this is the refetch window.
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables the Enable button while its request is in flight", async () => {
    listUsers.mockResolvedValue([disabledUser]);
    setUserEnabled.mockImplementation(() => new Promise(() => {}));

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Enable"));

    expect(screen.getByText("Enable").disabled).toBe(true);
    expect(setUserEnabled).toHaveBeenCalledTimes(1);

    // A second click while pending must not fire another request.
    fireEvent.click(screen.getByText("Enable"));
    expect(setUserEnabled).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm disable while its request is in flight", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    setUserEnabled.mockImplementation(() => new Promise(() => {}));

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Disable"));
    fireEvent.click(screen.getByText("Confirm disable"));

    expect(screen.getByText("Confirm disable").disabled).toBe(true);
    expect(setUserEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("UserManagement — load error recovery", () => {
  it("announces a load failure to screen readers and Retry reloads the list", async () => {
    listUsers.mockRejectedValueOnce(new Error("network down"));
    listUsers.mockResolvedValueOnce([enabledUser]);

    render(<UserManagement />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn't load users/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("admin@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("clears the error while the retry runs, so it cannot fire twice", async () => {
    listUsers.mockRejectedValueOnce(new Error("network down"));

    render(<UserManagement />);
    await screen.findByRole("alert");

    listUsers.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Exactly one reload: the error block (and its button) is gone for
    // the duration of the in-flight load.
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("keeps existing rows visible when a refetch after a toggle fails", async () => {
    listUsers.mockResolvedValueOnce([disabledUser]);
    listUsers.mockRejectedValueOnce(new Error("network down"));
    setUserEnabled.mockResolvedValue({ success: true });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Enable"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn't load users/i);
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
  });
});

describe("Header admin navigation", () => {
  it("2. no longer offers a direct User Management entry — Settings does", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        view="control"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    // The header entry point was removed; Settings hosts User Management
    // as an integrated section (covered end-to-end in settings.test.jsx).
    expect(screen.queryByText("User Management")).toBeNull();
    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("3. hides the User Management control from non-admins", () => {
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
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

  it("keeps the header identical on the users view — Settings is the only way out", () => {
    const onNavigate = vi.fn();
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        view="users"
        onNavigate={onNavigate}
        onLogout={() => {}}
      />,
    );

    // No contextual nav buttons are reinstated while in the view.
    expect(screen.queryByText("User Management")).toBeNull();
    expect(screen.queryByText("Control Room")).toBeNull();

    // The exit path is Settings -> Back to Control Room (covered
    // end-to-end in settings.test.jsx).
    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });
});

describe("UserManagement — password visibility toggles", () => {
  it("both add-mode fields start hidden, toggle independently, and keep values", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add User"));

    const password = screen.getByLabelText("Password");
    const confirm = screen.getByLabelText("Confirm Password");
    expect(password.type).toBe("password");
    expect(confirm.type).toBe("password");
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);

    fireEvent.change(password, { target: { value: STRONG } });
    fireEvent.change(confirm, { target: { value: STRONG } });

    // Reveal ONLY the first field — the confirm field stays hidden and
    // neither value may change.
    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(password.type).toBe("text");
    expect(confirm.type).toBe("password");
    expect(password.value).toBe(STRONG);
    expect(confirm.value).toBe(STRONG);
    expect(screen.getAllByRole("button", { name: "Hide password" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(1);

    // Hide it again — value still intact.
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
    expect(password.value).toBe(STRONG);
    expect(confirm.value).toBe(STRONG);
  });

  it("keeps add-user validation intact while revealing the confirm field", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add User"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Mismatched!Pass1" },
    });

    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Create User").disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[1]);

    const confirm = screen.getByLabelText("Confirm Password");
    expect(confirm.type).toBe("text");
    expect(confirm.value).toBe("Mismatched!Pass1");
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Create User").disabled).toBe(true);
  });
});

describe("UserManagement — dialog dismissal", () => {
  it("closes the Add User dialog on Escape and returns focus to its opener", async () => {
    listUsers.mockResolvedValue([]);
    render(<UserManagement />);

    const opener = await screen.findByText("Add User");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Add User");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
