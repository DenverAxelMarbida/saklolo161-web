import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Header from "../src/components/Header";
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
  it("shows Change Password to an admin (alongside User Management)", () => {
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        role="admin"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText("Change Password")).toBeTruthy();
    expect(screen.getByText("User Management")).toBeTruthy();
  });

  it("shows Change Password to a dispatcher, with no User Management control", () => {
    render(
      <Header
        dutyOfficer="fire@marikina.gov.ph"
        role="dispatcher"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.getByText("Change Password")).toBeTruthy();
    expect(screen.queryByText("User Management")).toBeNull();
    expect(screen.getByText("Logout")).toBeTruthy();
  });

  it("opens the modal with the three password fields and the checklist", () => {
    render(
      <Header
        dutyOfficer="admin@marikina.gov.ph"
        role="admin"
        view="control"
        onNavigate={() => {}}
        onLogout={() => {}}
      />,
    );

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
});
