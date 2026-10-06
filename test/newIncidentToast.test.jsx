import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import NewIncidentToast from "../src/components/NewIncidentToast";
import { CATEGORIES } from "../src/lib/config";

function makeToast(overrides = {}) {
  return {
    id: "INC-20261005-1234",
    category: "FLOOD",
    count: 1,
    ...overrides,
  };
}

// jsdom normalizes inline hex colors to rgb() — compare in that form.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
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

describe("NewIncidentToast — category theming", () => {
  it.each(["MEDICAL", "FIRE", "FLOOD", "CRIME"])(
    "%s receives the %s theme from the config source of truth",
    (category) => {
      render(<NewIncidentToast toast={makeToast({ category })} onClose={() => {}} />);

      const root = screen.getByRole("status");
      expect(root.dataset.theme).toBe(category.toLowerCase());
      // Accent color must be exactly what CATEGORIES defines — no
      // duplicate/competing color definitions.
      expect(root.dataset.accent).toBe(CATEGORIES[category].color);
      expect(screen.getByText(category)).toBeTruthy();
    },
  );

  it("normalizes lowercase category input to the config theme", () => {
    render(<NewIncidentToast toast={makeToast({ category: "fire" })} onClose={() => {}} />);

    const root = screen.getByRole("status");
    expect(root.dataset.theme).toBe("fire");
    expect(root.dataset.accent).toBe(CATEGORIES.FIRE.color);
    // Displayed with the canonical config casing.
    expect(screen.getByText("FIRE")).toBeTruthy();
  });

  it("uses the neutral fallback theme for an unknown category", () => {
    render(<NewIncidentToast toast={makeToast({ category: "ZOMBIE" })} onClose={() => {}} />);

    const root = screen.getByRole("status");
    expect(root.dataset.theme).toBe("neutral");
    // The fallback must never be a real category color.
    for (const key of Object.keys(CATEGORIES)) {
      expect(root.dataset.accent).not.toBe(CATEGORIES[key].color);
    }
    // The raw value is still shown so ops can see what arrived.
    expect(screen.getByText("ZOMBIE")).toBeTruthy();
  });

  it("uses the neutral fallback theme when the category is missing", () => {
    render(<NewIncidentToast toast={makeToast({ category: undefined })} onClose={() => {}} />);

    const root = screen.getByRole("status");
    expect(root.dataset.theme).toBe("neutral");
    expect(screen.getByText("UNKNOWN")).toBeTruthy();
  });

  it("renders a colored category indicator using the themed accent", () => {
    render(<NewIncidentToast toast={makeToast({ category: "MEDICAL" })} onClose={() => {}} />);

    const root = screen.getByRole("status");
    const dot = root.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeTruthy();
    expect(dot.getAttribute("style")).toContain(
      hexToRgb(CATEGORIES.MEDICAL.color),
    );
  });
});
