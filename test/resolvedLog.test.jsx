import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ResolvedLog from "../src/components/ResolvedLog";

// ResolvedDetailModal pulls in the map; only mounts on row click (never
// in these tests), but its import chain would still load mapbox.
vi.mock("../src/components/MiniIncidentMap", () => ({
  default: () => <div data-testid="mini-map" />,
}));

function makeResolved(overrides = {}) {
  return {
    id: "INC-1",
    category: "FLOOD",
    status: "RESOLVED",
    priority: "MEDIUM",
    location: "Marikina City",
    coords: { lat: 14.65, lng: 121.1 },
    callerNotes: "",
    evidence: [],
    station: null,
    dispatch: null,
    resolvedAt: "2026-10-01T08:00:00.000Z",
    elapsedMinutes: 60,
    ...overrides,
  };
}

function rowIds() {
  return screen
    .getAllByRole("button")
    .map((button) => button.textContent);
}

describe("ResolvedLog — loading and error states", () => {
  it("shows skeleton rows instead of the empty message while loading", () => {
    render(<ResolvedLog incidents={[]} query="" loading />);

    expect(screen.queryByText("No resolved incidents yet.")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading resolved incidents");
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state instead of claiming the log is empty when the load failed", () => {
    render(
      <ResolvedLog incidents={[]} query="" error={new Error("network down")} />,
    );

    expect(screen.queryByText("No resolved incidents yet.")).toBeNull();
    expect(screen.getByText(/couldn't load resolved incidents/i)).toBeTruthy();
  });

  it("keeps the genuine empty message once loading finishes without error", () => {
    render(<ResolvedLog incidents={[]} query="" />);
    expect(screen.getByText("No resolved incidents yet.")).toBeTruthy();
  });

  it("still lists resolved incidents alongside a background refresh error", () => {
    render(
      <ResolvedLog
        incidents={[makeResolved()]}
        query=""
        error={new Error("network down")}
      />,
    );

    expect(screen.getByText("#INC-1")).toBeTruthy();
    expect(screen.queryByText(/couldn't load resolved incidents/i)).toBeNull();
  });
});

describe("ResolvedLog ordering", () => {
  it("lists the most recently resolved incident first", () => {
    const older = makeResolved({
      id: "INC-OLDER",
      resolvedAt: "2026-09-30T08:00:00.000Z",
    });
    const newer = makeResolved({
      id: "INC-NEWER",
      resolvedAt: "2026-10-01T08:00:00.000Z",
    });
    const oldest = makeResolved({
      id: "INC-OLDEST",
      resolvedAt: "2026-09-29T08:00:00.000Z",
    });

    render(<ResolvedLog incidents={[older, newer, oldest]} query="" />);

    const rows = rowIds();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("INC-NEWER");
    expect(rows[1]).toContain("INC-OLDER");
    expect(rows[2]).toContain("INC-OLDEST");
  });

  it("keeps the incoming order for records without resolvedAt (pre-contract fallback)", () => {
    const a = makeResolved({ id: "INC-A", resolvedAt: null });
    const b = makeResolved({ id: "INC-B", resolvedAt: null });

    render(<ResolvedLog incidents={[a, b]} query="" />);

    const rows = rowIds();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("INC-A");
    expect(rows[1]).toContain("INC-B");
  });
});
