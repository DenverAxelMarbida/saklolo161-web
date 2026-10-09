import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResolvedLog from "../src/components/ResolvedLog";
import { formatResolvedDate } from "../src/components/ResolvedDetailModal";
import { normalizeIncident } from "../src/lib/api";
import {
  PRODUCTION_INCIDENTS,
  PRODUCTION_SERVED_ORDER,
} from "./fixtures.production";

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

describe("ResolvedLog resolved date/time", () => {
  it("renders the resolved date/time on the card, sourced from resolvedAt", () => {
    const resolvedAt = "2026-10-01T08:00:00.000Z";
    render(
      <ResolvedLog
        incidents={[makeResolved({ id: "INC-DATE", resolvedAt })]}
        query=""
      />,
    );

    // Same formatter as the Resolved detail modal (project convention).
    expect(
      screen.getByText(`Resolved ${formatResolvedDate(resolvedAt)}`),
    ).toBeTruthy();
  });

  it("renders an em dash when resolvedAt is missing (never a fabricated time)", () => {
    render(
      <ResolvedLog
        incidents={[makeResolved({ id: "INC-MISSING", resolvedAt: null })]}
        query=""
      />,
    );

    expect(screen.getByText("Resolved —")).toBeTruthy();
  });

  it("places timed records above records without resolvedAt without crashing", () => {
    const missingA = makeResolved({ id: "INC-MISSING-A", resolvedAt: null });
    const newer = makeResolved({
      id: "INC-NEWER-2",
      resolvedAt: "2026-10-02T08:00:00.000Z",
    });
    const older = makeResolved({
      id: "INC-OLDER-2",
      resolvedAt: "2026-09-30T08:00:00.000Z",
    });
    const missingB = makeResolved({
      id: "INC-MISSING-B",
      resolvedAt: undefined,
    });

    render(
      <ResolvedLog
        incidents={[missingA, newer, older, missingB]}
        query=""
      />,
    );

    const rows = rowIds();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain("INC-NEWER-2");
    expect(rows[1]).toContain("INC-OLDER-2");
    // Missing-resolvedAt records sink below timed ones, keep incoming order.
    expect(rows[2]).toContain("INC-MISSING-A");
    expect(rows[3]).toContain("INC-MISSING-B");
  });
});

describe("ResolvedLog — live production payload regression (captured 2026-10-07)", () => {
  // Exact input construction the app runs: normalizeIncident per record;
  // the component then applies its RESOLVED filter + resolvedAt sort.
  const normalized = PRODUCTION_SERVED_ORDER.map((id) =>
    normalizeIncident(PRODUCTION_INCIDENTS[id]),
  );

  it("renders the real persisted date and puts that incident first", () => {
    render(<ResolvedLog incidents={normalized} query="" />);

    const expected = formatResolvedDate("2026-10-07T14:40:30.168Z");
    const rows = rowIds();
    expect(rows[0]).toContain("INC-20261007-9431");
    expect(rows[0]).toContain(expected);
  });

  it("renders the historical production incidents as 'Resolved —' below it, in stable served order", () => {
    render(<ResolvedLog incidents={normalized} query="" />);

    // 7190 / 1575 / 5320 / 5191 genuinely have NO resolvedAt in the
    // production store (deployed backend never persisted it).
    expect(screen.getAllByText("Resolved —")).toHaveLength(4);
    const rows = rowIds();
    expect(rows).toHaveLength(5);
    expect(rows[1]).toContain("INC-20261004-7190");
    expect(rows[2]).toContain("INC-20261005-1575");
    expect(rows[3]).toContain("INC-20261005-5320");
    expect(rows[4]).toContain("INC-20261007-5191");
  });

  it("renders an em dash for an invalid resolvedAt string", () => {
    render(
      <ResolvedLog
        incidents={[makeResolved({ id: "INC-INVALID", resolvedAt: "not-a-timestamp" })]}
        query=""
      />,
    );

    expect(screen.getByText("Resolved —")).toBeTruthy();
  });
});
