import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import NewIncidentToast from "../src/components/NewIncidentToast";

function makeToast(overrides = {}) {
  return {
    id: "INC-20261005-1234",
    category: "FLOOD",
    count: 1,
    ...overrides,
  };
}

describe("NewIncidentToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the incident id and category", () => {
    render(<NewIncidentToast toast={makeToast()} onClose={() => {}} />);

    expect(screen.getByText(/New Incident/i)).toBeTruthy();
    expect(screen.getByText(/INC-20261005-1234/)).toBeTruthy();
    expect(screen.getByText("FLOOD")).toBeTruthy();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("mentions additional incidents when the batch is bigger than one", () => {
    render(<NewIncidentToast toast={makeToast({ count: 3 })} onClose={() => {}} />);

    expect(screen.getByText(/2 more/)).toBeTruthy();
  });

  it("auto-dismisses after its timeout", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<NewIncidentToast toast={makeToast()} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(4400);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount so nothing leaks", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(<NewIncidentToast toast={makeToast()} onClose={onClose} />);

    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses on the manual close button", () => {
    const onClose = vi.fn();
    render(<NewIncidentToast toast={makeToast()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
