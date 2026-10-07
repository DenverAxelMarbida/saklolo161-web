import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("ResolvedLog live evidence sync", () => {
  it("shows evidence that arrives AFTER the detail modal is open", async () => {
    const stale = makeResolved({ id: "INC-LATE", evidence: [] });

    const { rerender } = render(<ResolvedLog incidents={[stale]} query="" />);

    // Dispatcher opens the resolved detail while evidence is still inbound.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText(/evidence file/)).toBeNull();

    // The citizen's upload lands on the next poll — the open modal must
    // pick it up without a close/reopen or a browser refresh.
    const fresh = makeResolved({
      id: "INC-LATE",
      evidence: [
        {
          fileId: "ev-1",
          url: "/api/incidents/INC-LATE/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 120,
          uploadedAt: "2026-10-01T09:00:00.000Z",
        },
      ],
    });
    rerender(<ResolvedLog incidents={[fresh]} query="" />);

    expect(await screen.findByText("1 evidence file")).toBeTruthy();
  });

  it("keeps the modal closed state when no fresh copy exists", async () => {
    const stale = makeResolved({ id: "INC-GONE" });

    const { rerender } = render(<ResolvedLog incidents={[stale]} query="" />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Incident dropped from the polled list (e.g. filtered out) — the open
    // modal must not crash.
    rerender(<ResolvedLog incidents={[]} query="" />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
