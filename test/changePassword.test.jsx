import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Header from "../src/components/Header";
import Settings from "../src/components/Settings";
import ChangePasswordModal from "../src/components/ChangePasswordModal";
import {
  PASSWORD_REQUIREMENTS,
  passwordFailures,
  isStrongPassword,
} from "../src/lib/passwordPolicy";

vi.mock("../src/lib/api", () => ({
  changeOwnPassword: vi.fn(),
}));

import { changeOwnPassword } from "../src/lib/api";

const STRONG = "Str0ngPass!xK9pQ2";

const adminUser = {
  uid: "uid-admin",
  email: "admin@marikina.gov.ph",
  agency: "ALL",
  role: "admin",
};

function fillModal({
  current = "OldPass!xK9pQ2v3",
  next = STRONG,
  confirm = STRONG,
} = {}) {
  fireEvent.change(screen.getByLabelText("Current Password"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("New Password"), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), {
    target: { value: confirm },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("password policy (web mirror)", () => {
  it("accepts exactly 16 characters with every rule satisfied", () => {
    expect(isStrongPassword("Ab1!Ab1!Ab1!Ab1!")).toBe(true);
    expect(passwordFailures("Ab1!Ab1!Ab1!Ab1!")).toEqual([]);
  });

  it.each([
    ["too short", "Sh0rt!Pass"],
    ["no lowercase", "AAAAAAA1!AAAAAAAA"],
    ["no uppercase", "aaaaaaa1!aaaaaaaa"],
    ["no number", "Abc!Abc!Abc!Abc!A"],
    ["no special", "Abc1Abc1Abc1Abc1A"],
  ])("rejects a password that is %s", (_label, password) => {
    expect(isStrongPassword(password)).toBe(false);
    expect(passwordFailures(password).length).toBeGreaterThan(0);
  });

  it("exposes exactly five requirements for the checklist", () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
    expect(PASSWORD_REQUIREMENTS.map((r) => r.id)).toEqual([
      "length",
      "lowercase",
      "uppercase",
      "number",
      "special",
    ]);
  });
});

describe("Header — Change Password access", () => {
  it("no longer offers Change Password or User Management to an admin", () => {
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
    // Settings is now the single entry point for both.
    expect(screen.getByLabelText("Settings")).toBeTruthy();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("no longer offers Change Password to a dispatcher either", () => {
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.queryByText("Change Password")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("still opens the existing modal with the three password fields and the checklist (from Settings)", () => {
    render(<Settings user={adminUser} onNavigate={() => {}} />);

    fireEvent.click(screen.getByText("Change Password"));

    expect(screen.getByLabelText("Current Password")).toBeTruthy();
    expect(screen.getByLabelText("New Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm New Password")).toBeTruthy();
    expect(screen.getByText("At least 16 characters")).toBeTruthy();
    expect(screen.getByText("One special character")).toBeTruthy();
  });
});

describe("ChangePasswordModal", () => {
  it("starts with the submit disabled", () => {
    render(<ChangePasswordModal onClose={() => {}} />);
    expect(screen.getByText("Update Password").closest("button").disabled).toBe(true);
  });

  it("keeps the submit disabled until current is set, new is strong, and confirm matches", () => {
    render(<ChangePasswordModal onClose={() => {}} />);
    const submit = screen.getByText("Update Password").closest("button");

    // current + weak new → disabled
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "OldPass!xK9pQ2v3" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "weak" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "weak" },
    });
    expect(submit.disabled).toBe(true);

    // strong new but confirm mismatch → disabled + live message
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: STRONG },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Mismatched!Pass1" },
    });
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();

    // fully valid → enabled
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: STRONG },
    });
    expect(submit.disabled).toBe(false);
  });

  it("disables the submit when the new password equals the current one", () => {
    render(<ChangePasswordModal onClose={() => {}} />);
    const submit = screen.getByText("Update Password").closest("button");

    fillModal({ current: STRONG, next: STRONG, confirm: STRONG });

    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText("New password must be different from the current password."),
    ).toBeTruthy();
  });

  it("marks checklist requirements live as the new password is typed", () => {
    const { container } = render(<ChangePasswordModal onClose={() => {}} />);

    const met = () =>
      [...container.querySelectorAll("li[data-met]")].map((li) => [
        li.textContent,
        li.getAttribute("data-met"),
      ]);

    // All unmet while empty.
    expect(met().every(([, value]) => value === "false")).toBe(true);

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: STRONG },
    });
    expect(met().every(([, value]) => value === "true")).toBe(true);
  });

  it("submits changeOwnPassword with the three fields", async () => {
    changeOwnPassword.mockResolvedValue({
      success: true,
      message: "Password changed successfully.",
    });
    render(<ChangePasswordModal onClose={() => {}} />);

    fillModal();
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() =>
      expect(changeOwnPassword).toHaveBeenCalledWith({
        currentPassword: "OldPass!xK9pQ2v3",
        newPassword: STRONG,
        confirmNewPassword: STRONG,
      }),
    );
  });

  it("shows a loading state while the request is in flight, then the success message and cleared fields", async () => {
    let resolveRequest;
    changeOwnPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<ChangePasswordModal onClose={() => {}} />);

    fillModal();
    fireEvent.click(screen.getByText("Update Password"));

    const loading = await screen.findByText("Changing…");
    expect(loading.closest("button").disabled).toBe(true);

    resolveRequest({ success: true, message: "Password changed successfully." });

    expect(await screen.findByText("Password changed successfully.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText("Current Password").value).toBe("");
      expect(screen.getByLabelText("New Password").value).toBe("");
      expect(screen.getByLabelText("Confirm New Password").value).toBe("");
    });
    expect(changeOwnPassword).toHaveBeenCalledTimes(1);
  });

  it("surfaces the backend's 400 message (wrong current password)", async () => {
    changeOwnPassword.mockRejectedValue({
      response: { data: { message: "Current password is incorrect." } },
    });
    render(<ChangePasswordModal onClose={() => {}} />);

    fillModal();
    fireEvent.click(screen.getByText("Update Password"));

    expect(await screen.findByText("Current password is incorrect.")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText("Current Password").value).not.toBe(""),
    );
  });

  it("falls back to a generic message when the request fails without one", async () => {
    changeOwnPassword.mockRejectedValue(new Error("network down"));
    render(<ChangePasswordModal onClose={() => {}} />);

    fillModal();
    fireEvent.click(screen.getByText("Update Password"));

    expect(
      await screen.findByText("Couldn't change the password. Try again."),
    ).toBeTruthy();
  });

  it("closes via the Cancel button without calling the API", () => {
    const onClose = vi.fn();
    render(<ChangePasswordModal onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });

  it("closes on Escape without calling the API", () => {
    const onClose = vi.fn();
    render(<ChangePasswordModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });
});

describe("ChangePasswordModal — password visibility toggles", () => {
  it("all three fields start hidden, toggle independently, and keep their values", () => {
    render(<ChangePasswordModal onClose={() => {}} />);

    const current = screen.getByLabelText("Current Password");
    const next = screen.getByLabelText("New Password");
    const confirm = screen.getByLabelText("Confirm New Password");
    expect([current.type, next.type, confirm.type]).toEqual([
      "password",
      "password",
      "password",
    ]);
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(3);

    fillModal();

    // Reveal ONLY the current-password field — the other two must stay
    // hidden, and no value may change.
    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(current.type).toBe("text");
    expect(next.type).toBe("password");
    expect(confirm.type).toBe("password");
    expect(current.value).toBe("OldPass!xK9pQ2v3");
    expect(next.value).toBe(STRONG);
    expect(confirm.value).toBe(STRONG);
    expect(screen.getAllByRole("button", { name: "Hide password" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);

    // Hide it again — everything returns to the default state intact.
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect([current.type, next.type, confirm.type]).toEqual([
      "password",
      "password",
      "password",
    ]);
    expect(current.value).toBe("OldPass!xK9pQ2v3");
  });

  it("keeps the mismatch validation visible while the confirm field is revealed", () => {
    render(<ChangePasswordModal onClose={() => {}} />);

    fillModal({ next: STRONG, confirm: "Mismatched!Pass1" });
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[2]);

    const confirm = screen.getByLabelText("Confirm New Password");
    expect(confirm.type).toBe("text");
    expect(confirm.value).toBe("Mismatched!Pass1");
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByText("Update Password").closest("button").disabled).toBe(
      true,
    );
  });
});
