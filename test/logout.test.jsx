import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "../src/components/Header";

// Logout is a destructive, session-ending action: these cover the danger
// styling, the confirmation step (nothing logs out on first click), every
// dismissal path, and the dialog's accessibility contract.

function renderHeader(onLogout = vi.fn()) {
  const onNavigate = vi.fn();
  const view = render(
    <Header
      dutyOfficer="fire@marikina.gov.ph"
      view="control"
      onNavigate={onNavigate}
      onLogout={onLogout}
    />,
  );
  return { ...view, onLogout, onNavigate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Header — logout control", () => {
  it("is styled as a danger action", () => {
    renderHeader();

    const button = screen.getByText("Logout").closest("button");
    expect(button.className).toContain("bg-fire");
    expect(button.className).toContain("text-header");
    // Still a header control, not a full-width CTA.
    expect(button.className).toContain("rounded-md");
  });

  it("opens a confirmation dialog instead of logging out immediately", () => {
    const { onLogout } = renderHeader();

    fireEvent.click(screen.getByText("Logout"));

    expect(onLogout).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Log out?" })).toBeTruthy();
    expect(screen.getByText(/need to sign in again/)).toBeTruthy();
  });

  it("labels and describes the dialog from its own content", () => {
    renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    const dialog = screen.getByRole("dialog");
    const label = document.getElementById(dialog.getAttribute("aria-labelledby"));
    const description = document.getElementById(dialog.getAttribute("aria-describedby"));

    expect(label.textContent).toBe("Log out?");
    expect(description.textContent).toMatch(/need to sign in again/);
  });

  it("Cancel closes the dialog without logging out", () => {
    const { onLogout } = renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("Escape closes the dialog without logging out", () => {
    const { onLogout } = renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("clicking the backdrop closes the dialog without logging out", () => {
    const { onLogout } = renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("Log Out confirms and calls the logout handler exactly once", () => {
    const { onLogout } = renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    fireEvent.click(screen.getByText("Log Out"));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses the safe action on open and returns focus to Logout on close", () => {
    renderHeader();

    fireEvent.click(screen.getByText("Logout"));
    expect(document.activeElement.textContent).toBe("Cancel");

    fireEvent.click(screen.getByText("Cancel"));
    expect(document.activeElement).toBe(screen.getByText("Logout"));
  });

  it("keeps the Settings gear as the header's navigation control", () => {
    const { onNavigate } = renderHeader();

    fireEvent.click(screen.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });
});
