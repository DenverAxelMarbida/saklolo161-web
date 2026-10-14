import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import UserManagement from "../src/components/UserManagement";
import Header from "../src/components/Header";

vi.mock("../src/lib/api", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserEnabled: vi.fn(),
  adminSetUserPassword: vi.fn(),
  changeOwnPassword: vi.fn(),
}));

import {
  listUsers,
  createUser,
  updateUser,
  setUserEnabled,
  adminSetUserPassword,
} from "../src/lib/api";

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
    // Row assertions are scoped to the table — the search/filter bar
    // reuses the same words ("ALL" agency option, "Disabled" status
    // option) outside of it.
    const table = screen.getByRole("table");
    expect(within(table).getByText("ALL")).toBeTruthy();
    expect(within(table).getByText("FIRE")).toBeTruthy();
    expect(within(table).getByText("admin")).toBeTruthy();
    expect(within(table).getByText("dispatcher")).toBeTruthy();
    expect(within(table).getByText("Enabled")).toBeTruthy();
    expect(within(table).getByText("Disabled")).toBeTruthy();
  });

  it("4. the Add Account form submits createUser with email, password, agency, role", async () => {
    listUsers.mockResolvedValue([]);
    createUser.mockResolvedValue({ success: true, data: makeUser({ uid: "uid-new" }) });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add Account"));

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

    const submit = screen.getByText("Create Account");
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

  it("keeps Create Account disabled for a weak password and shows the live checklist", async () => {
    listUsers.mockResolvedValue([]);

    const { container } = render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add Account"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret123" },
    });

    expect(screen.getByText("Create Account").disabled).toBe(true);
    expect(container.querySelectorAll("li[data-met]").length).toBe(5);
    expect(
      container.querySelector('li[data-met="false"]'),
    ).toBeTruthy();
  });

  it("keeps Create Account disabled until Confirm Password matches", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Add Account"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Mismatched!Pass1" },
    });

    expect(screen.getByText("Create Account").disabled).toBe(true);
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: STRONG },
    });
    expect(screen.getByText("Create Account").disabled).toBe(false);
  });

  it("5. Edit opens the form pre-filled with the existing user data (no password field)", async () => {
    listUsers.mockResolvedValue([enabledUser]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Edit"));

    // Scoped to the dialog — the filter bar has its own Agency/Role labels.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Email").value).toBe("admin@marikina.gov.ph");
    expect(within(dialog).getByLabelText("Agency").value).toBe("ALL");
    expect(within(dialog).getByLabelText("Role").value).toBe("admin");
    // Edit must never ask for or expose a password.
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("6. Edit submits updateUser with the changed fields", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    updateUser.mockResolvedValue({ success: true, data: enabledUser });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Agency"), {
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

  it("7. Disable opens a dialog demanding the admin's own password, then calls setUserEnabled with it", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    setUserEnabled.mockResolvedValue({ success: true, message: "User disabled.", data: enabledUser });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Disable"));

    // The dialog identifies the account and demands reauthentication.
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Disable Account");
    expect(dialog.textContent).toContain("admin@marikina.gov.ph");

    // No API call before the admin enters their password and confirms.
    expect(setUserEnabled).not.toHaveBeenCalled();
    // Confirm stays disabled while the password field is empty.
    expect(screen.getByText("Confirm Disable").disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    expect(screen.getByText("Confirm Disable").disabled).toBe(false);
    fireEvent.click(screen.getByText("Confirm Disable"));

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("uid-1", false, {
        adminPassword: "AdminPass!xK9pQ2",
      }),
    );
    // Success closes the dialog and surfaces the backend message.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("User disabled.")).toBeTruthy();
  });

  it("keeps the Disable dialog open and shows the error when reauthentication fails", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    setUserEnabled.mockRejectedValue({
      response: { data: { message: "Administrator password is incorrect." } },
    });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Disable"));
    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "WrongPass!123" },
    });
    fireEvent.click(screen.getByText("Confirm Disable"));

    // The raw backend message is translated for the admin.
    expect(
      await screen.findByText("That password is incorrect. Please enter your current administrator password and try again."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(setUserEnabled).toHaveBeenCalledTimes(1);
  });

  it("8. Enable calls setUserEnabled(uid, true) without any password", async () => {
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

    expect(await screen.findByText(/couldn't load accounts/i)).toBeTruthy();
    expect(screen.queryByText("admin@marikina.gov.ph")).toBeNull();
  });

  it("renders an empty state when there are no users", async () => {
    listUsers.mockResolvedValue([]);

    render(<UserManagement />);

    expect(await screen.findByText("No accounts found.")).toBeTruthy();
  });
});

describe("UserManagement — loading skeleton and pending toggles", () => {
  it("shows a skeleton region instead of a bare 'Loading accounts…' placeholder", async () => {
    listUsers.mockImplementation(() => new Promise(() => {}));

    render(<UserManagement />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toMatch(/loading accounts/i);
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText(/loading accounts/i)).toBeNull();
    expect(screen.queryByText("No accounts found.")).toBeNull();
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

  it("disables Confirm Disable while its request is in flight", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    setUserEnabled.mockImplementation(() => new Promise(() => {}));

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Disable"));
    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(screen.getByText("Confirm Disable"));

    // The pending button swaps its label and stays disabled.
    const pending = screen.getByText("Disabling…");
    expect(pending.disabled).toBe(true);
    expect(screen.queryByText("Confirm Disable")).toBeNull();
    expect(setUserEnabled).toHaveBeenCalledTimes(1);

    // A second click while pending must not fire another request.
    fireEvent.click(pending);
    expect(setUserEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("UserManagement — load error recovery", () => {
  it("announces a load failure to screen readers and Retry reloads the list", async () => {
    listUsers.mockRejectedValueOnce(new Error("network down"));
    listUsers.mockResolvedValueOnce([enabledUser]);

    render(<UserManagement />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn't load accounts/i);

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
    expect(alert.textContent).toMatch(/couldn't load accounts/i);
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
  });
});

describe("UserManagement — search, filters, selection, and bulk disable", () => {
  const self = makeUser(); // uid-1, admin — the signed-in administrator
  const fire = makeUser({
    uid: "uid-2",
    email: "fire@marikina.gov.ph",
    agency: "FIRE",
    role: "dispatcher",
  });
  const flood = makeUser({
    uid: "uid-3",
    email: "flood@marikina.gov.ph",
    agency: "FLOOD",
    role: "dispatcher",
  });
  const retired = makeUser({
    uid: "uid-4",
    email: "old@marikina.gov.ph",
    agency: "MEDICAL",
    role: "dispatcher",
    disabled: true,
  });
  const all = [self, fire, flood, retired];
  const currentUser = { uid: "uid-1", email: "admin@marikina.gov.ph", agency: "ALL", role: "admin" };

  const renderAs = (users = all) => {
    listUsers.mockResolvedValue(users);
    render(<UserManagement currentUser={currentUser} />);
    return screen.findByText("old@marikina.gov.ph");
  };

  const selectAccount = (email) => {
    fireEvent.click(screen.getByLabelText(`Select ${email}`));
  };

  const openBulkDialog = async (emails) => {
    await renderAs();
    for (const email of emails) selectAccount(email);
    fireEvent.click(screen.getByText("Disable Selected"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Disable Selected Accounts");
    return dialog;
  };

  const confirmWith = (dialog, password) => {
    fireEvent.change(within(dialog).getByLabelText("Your Current Password"), {
      target: { value: password },
    });
    fireEvent.click(within(dialog).getByText(/Disable \d+ Accounts?/));
  };

  it("searches by email case-insensitively, trims whitespace, and never refetches while typing", async () => {
    await renderAs();

    fireEvent.change(screen.getByLabelText("Search by email"), {
      target: { value: "  FIRE@MARIKINA " },
    });

    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByText("admin@marikina.gov.ph")).toBeNull();
    expect(screen.queryByText("flood@marikina.gov.ph")).toBeNull();
    // Client-side only: the list was fetched once, typing fires nothing.
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("filters by agency, role, and status — combined with search", async () => {
    await renderAs();

    fireEvent.change(screen.getByLabelText("Agency"), { target: { value: "FLOOD" } });
    expect(screen.getByText("flood@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByText("fire@marikina.gov.ph")).toBeNull();

    // Role narrows further; status incompatible with the match empties the list.
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "admin" } });
    expect(
      await screen.findByText("No accounts match your search or filters."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "disabled" } });
    expect(await screen.findByText("No accounts match your search or filters.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Agency"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "disabled" } });
    expect(await screen.findByText("old@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByText("fire@marikina.gov.ph")).toBeNull();
  });

  it("resetting filters returns to the full list", async () => {
    await renderAs();

    fireEvent.change(screen.getByLabelText("Search by email"), {
      target: { value: "no-such-user" },
    });
    expect(await screen.findByText("No accounts match your search or filters.")).toBeTruthy();

    fireEvent.click(screen.getByText("Reset filters"));
    expect(await screen.findByText("admin@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByText("fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.queryByText("No accounts match your search or filters.")).toBeNull();
  });

  it("only eligible accounts get checkboxes; the admin's own and disabled accounts are excluded", async () => {
    await renderAs();

    expect(screen.getByLabelText("Select fire@marikina.gov.ph")).toBeTruthy();
    expect(screen.getByLabelText("Select flood@marikina.gov.ph")).toBeTruthy();
    // Own account: marked, never selectable for bulk disable.
    expect(screen.queryByLabelText("Select admin@marikina.gov.ph")).toBeNull();
    expect(screen.getByText("(you)")).toBeTruthy();
    // Already-disabled accounts can't be selected for another disable.
    expect(screen.queryByLabelText("Select old@marikina.gov.ph")).toBeNull();
  });

  it("select-all covers only eligible accounts in the current filter, and toggles off", async () => {
    await renderAs();

    fireEvent.click(screen.getByLabelText("Select all eligible accounts"));
    expect(screen.getByText("2 accounts selected.")).toBeTruthy();
    expect(screen.getByLabelText("Select fire@marikina.gov.ph").checked).toBe(true);
    expect(screen.getByLabelText("Select flood@marikina.gov.ph").checked).toBe(true);

    // Narrow the filter: select-all state follows the visible set.
    fireEvent.change(screen.getByLabelText("Agency"), { target: { value: "FIRE" } });
    fireEvent.click(screen.getByLabelText("Select all eligible accounts"));
    expect(screen.getByText("1 account selected.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Agency"), { target: { value: "all" } });
    fireEvent.click(screen.getByLabelText("Select all eligible accounts"));
    expect(screen.getByText("2 accounts selected.")).toBeTruthy();
  });

  it("Disable Selected stays disabled with nothing selected and names the affected count", async () => {
    await renderAs();

    expect(screen.getByText("Disable Selected").disabled).toBe(true);
    expect(screen.getByText("No accounts selected.")).toBeTruthy();

    selectAccount("fire@marikina.gov.ph");
    selectAccount("flood@marikina.gov.ph");
    expect(screen.getByText("2 accounts selected.")).toBeTruthy();
    expect(screen.getByText("Disable Selected").disabled).toBe(false);

    fireEvent.click(screen.getByText("Disable Selected"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Disable 2 accounts");
    expect(dialog.textContent).toContain("fire@marikina.gov.ph");
    expect(dialog.textContent).toContain("flood@marikina.gov.ph");
    expect(setUserEnabled).not.toHaveBeenCalled();
  });

  it("bulk disable sends one verified request per account, then refreshes and clears the selection", async () => {
    setUserEnabled.mockResolvedValue({ success: true, message: "User disabled." });
    const dialog = await openBulkDialog(["fire@marikina.gov.ph", "flood@marikina.gov.ph"]);

    confirmWith(dialog, "AdminPass!xK9pQ2");

    await waitFor(() =>
      expect(setUserEnabled).toHaveBeenCalledWith("uid-2", false, {
        adminPassword: "AdminPass!xK9pQ2",
      }),
    );
    expect(setUserEnabled).toHaveBeenCalledWith("uid-3", false, {
      adminPassword: "AdminPass!xK9pQ2",
    });
    expect(setUserEnabled).toHaveBeenCalledTimes(2);
    // Every request carries the password in the body — never a bare flag.
    for (const call of setUserEnabled.mock.calls) {
      expect(call[2]).toEqual({ adminPassword: "AdminPass!xK9pQ2" });
    }

    expect(await screen.findByText("Disabled 2 accounts.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(screen.getByText("No accounts selected.")).toBeTruthy();
  });

  it("canceling the bulk dialog performs no protected change", async () => {
    const dialog = await openBulkDialog(["fire@marikina.gov.ph"]);

    fireEvent.click(within(dialog).getByText("Cancel"));

    expect(setUserEnabled).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Disabled \d+ of/)).toBeNull();
    expect(screen.queryByText("Disabled 1 account.")).toBeNull();
  });

  it("a wrong bulk password changes nothing and keeps the dialog open for correction", async () => {
    setUserEnabled.mockRejectedValue({
      response: { data: { message: "Administrator password is incorrect." } },
    });
    const dialog = await openBulkDialog(["fire@marikina.gov.ph", "flood@marikina.gov.ph"]);

    confirmWith(dialog, "WrongPass!123");

    expect(
      await screen.findByText("That password is incorrect. Please enter your current administrator password and try again."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    // Both requests were attempted (and rejected) — but nothing
    // succeeded, so no success banner and no list refresh.
    expect(setUserEnabled).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Disabled \d+/)).toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("partial bulk failures report exactly which accounts failed and keep only those selected", async () => {
    setUserEnabled.mockImplementation((uid) =>
      uid === "uid-2"
        ? Promise.resolve({ success: true, message: "User disabled." })
        : Promise.reject({ response: { data: { message: "User not found." } } }),
    );
    // After the refresh the failed account is still enabled (eligible),
    // the succeeded one is disabled.
    listUsers
      .mockResolvedValueOnce(all)
      .mockResolvedValueOnce([
        self,
        { ...fire, disabled: true },
        flood,
        retired,
      ]);
    render(<UserManagement currentUser={currentUser} />);
    await screen.findByText("old@marikina.gov.ph");

    selectAccount("fire@marikina.gov.ph");
    selectAccount("flood@marikina.gov.ph");
    fireEvent.click(screen.getByText("Disable Selected"));
    confirmWith(screen.getByRole("dialog"), "AdminPass!xK9pQ2");

    expect(await screen.findByText("Disabled 1 of 2 accounts.")).toBeTruthy();
    const failure = await screen.findByText(/Couldn't disable 1 account:/);
    expect(failure.textContent).toContain("flood@marikina.gov.ph");
    // Only the failure stays selected — a retry can't re-disable the success.
    expect(screen.getByText("1 account selected.")).toBeTruthy();
    expect(screen.getByLabelText("Select flood@marikina.gov.ph").checked).toBe(true);
    expect(screen.queryByLabelText("Select fire@marikina.gov.ph")).toBeNull();
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
    expect(screen.queryByText("Account Management")).toBeNull();
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

    expect(screen.queryByText("Account Management")).toBeNull();
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
    expect(screen.queryByText("Account Management")).toBeNull();
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
    fireEvent.click(await screen.findByText("Add Account"));

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
    fireEvent.click(await screen.findByText("Add Account"));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Mismatched!Pass1" },
    });

    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Create Account").disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[1]);

    const confirm = screen.getByLabelText("Confirm Password");
    expect(confirm.type).toBe("text");
    expect(confirm.value).toBe("Mismatched!Pass1");
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Create Account").disabled).toBe(true);
  });
});

describe("UserManagement — dialog dismissal", () => {
  it("closes the Add Account dialog on Escape and returns focus to its opener", async () => {
    listUsers.mockResolvedValue([]);
    render(<UserManagement />);

    const opener = await screen.findByText("Add Account");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Add Account");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe("UserManagement — admin Change Password action", () => {
  const NEW_PASS = "N3wSecure!Passw0rd!";

  it("opens a dialog with only New Password and Confirm New Password (no admin reauth field)", async () => {
    listUsers.mockResolvedValue([enabledUser]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Change Account Password");
    expect(dialog.textContent).toContain("admin@marikina.gov.ph");
    expect(screen.getByLabelText("New Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm New Password")).toBeTruthy();
    // The administrator's current password is no longer requested.
    expect(screen.queryByLabelText("Your Current Password")).toBeNull();
    // No API call until the form is complete and submitted.
    expect(adminSetUserPassword).not.toHaveBeenCalled();
    expect(screen.getByText("Update Password").disabled).toBe(true);
  });

  it("keeps Update Password disabled until the new password is strong (8+ chars) and confirm matches", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    const submit = screen.getByText("Update Password");
    expect(submit.disabled).toBe(true); // empty form

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "Sh0rt!A" }, // 7 chars — below the 8-char minimum
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Sh0rt!A" },
    });
    expect(submit.disabled).toBe(true); // too short, even though they match

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: NEW_PASS },
    });
    expect(submit.disabled).toBe(true); // confirm now mismatches
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: NEW_PASS },
    });
    expect(submit.disabled).toBe(false);
  });

  it("submits adminSetUserPassword only after the admin re-proves their OWN password", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    adminSetUserPassword.mockResolvedValue({
      success: true,
      message: "Password updated successfully.",
    });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.click(screen.getByText("Update Password"));

    // The verification step opens — NO API call until the admin's own
    // password is submitted (the backend re-verifies it server-side).
    const verifyDialog = screen.getByRole("dialog");
    expect(verifyDialog.getAttribute("aria-label")).toBe("Verify Admin Password");
    expect(adminSetUserPassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(adminSetUserPassword).toHaveBeenCalledWith("uid-1", {
        newPassword: NEW_PASS,
        confirmNewPassword: NEW_PASS,
        adminPassword: "AdminPass!xK9pQ2",
      }),
    );

    // Success: backend-confirmed message shown, new-password fields cleared.
    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeTruthy();
    expect(screen.getByLabelText("New Password").value).toBe("");
    expect(screen.getByLabelText("Confirm New Password").value).toBe("");
  });

  it("keeps the verification dialog open on wrong credentials and corrects without losing the new password", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    adminSetUserPassword
      .mockRejectedValueOnce({
        response: { data: { message: "Administrator password is incorrect." } },
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Password updated successfully.",
      });

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.click(screen.getByText("Update Password"));

    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "WrongPass!123" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    // Error surfaces in the verification dialog, which stays open —
    // the account password is unchanged.
    expect(
      await screen.findByText("That password is incorrect. Please enter your current administrator password and try again."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
      "Verify Admin Password",
    );
    expect(adminSetUserPassword).toHaveBeenCalledTimes(1);

    // Retry with the correct password from the same dialog succeeds.
    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(screen.getByText("Update Password"));
    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeTruthy();
  });

  it("canceling the verification dialog never calls the API and returns to the password form", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.click(screen.getByText("Update Password"));

    fireEvent.click(screen.getByText("Cancel"));

    // Back on the password form — values retained, still no API call.
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
      "Change Account Password",
    );
    expect(screen.getByLabelText("New Password").value).toBe(NEW_PASS);
    expect(adminSetUserPassword).not.toHaveBeenCalled();
  });

  it("shows a pending state during verification and disables duplicate submission", async () => {
    let rejectRequest;
    adminSetUserPassword.mockReturnValue(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    listUsers.mockResolvedValue([enabledUser]);

    render(<UserManagement />);
    fireEvent.click(await screen.findByText("Change Password"));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: NEW_PASS },
    });
    fireEvent.click(screen.getByText("Update Password"));
    fireEvent.change(screen.getByLabelText("Your Current Password"), {
      target: { value: "AdminPass!xK9pQ2" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    // Pending: label swaps on the verification dialog's confirm button,
    // submit disables, no second request.
    const pending = await screen.findByText("Updating…");
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    expect(adminSetUserPassword).toHaveBeenCalledTimes(1);

    rejectRequest({
      response: { data: { message: "Password must be at least 8 characters." } },
    });

    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes on Escape without calling the API", async () => {
    listUsers.mockResolvedValue([enabledUser]);
    render(<UserManagement />);

    const opener = await screen.findByText("Change Password");
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(adminSetUserPassword).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });
});
