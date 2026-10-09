import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ActiveQueue from "../src/components/ActiveQueue";

function makeIncident(overrides = {}) {
  return {
    id: "INC-TEST-0001",
    category: "FLOOD",
    status: "PENDING",
    priority: "MEDIUM",
    location: "Marikina City",
    coords: { lat: 14.65, lng: 121.1 },
    callerNotes: "Water rising near the bridge.",
    evidence: [],
    evidenceUploading: false,
    evidenceExpectedCount: 0,
    evidenceFailedCount: 0,
    evidenceAttempt: 0,
    evidenceAttemptsTotal: 0,
    station: null,
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

function renderQueue(incidents, newIncidentIds = []) {
  return render(
    <ActiveQueue
      incidents={incidents}
      onSelectIncident={() => {}}
      activeFilter="ALL"
      onFilterChange={() => {}}
      newIncidentIds={newIncidentIds}
    />,
  );
}

describe("ActiveQueue", () => {
  it("shows nothing evidence-related on a plain report", () => {
    renderQueue([makeIncident()]);

    expect(screen.queryByText(/attaching evidence/)).toBeNull();
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it("badges a report whose attachments are still uploading", () => {
    renderQueue([
      makeIncident({
        evidence: [{ fileId: "ev-1", url: "" }],
        evidenceUploading: true,
        evidenceExpectedCount: 3,
      }),
    ]);

    expect(screen.getByText(/⏳ attaching evidence 1\/3/)).toBeTruthy();
  });

  it("shows an honest retry chip when an automatic attempt is in flight", () => {
    renderQueue([
      makeIncident({
        evidence: [{ fileId: "ev-1", url: "" }],
        evidenceUploading: true,
        evidenceExpectedCount: 3,
        evidenceAttempt: 2,
        evidenceAttemptsTotal: 3,
      }),
    ]);

    expect(screen.getByTestId("queue-evidence-chip").textContent).toBe("↻ retrying 2/3");
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("flags a report with failed attachments once the loop finishes", () => {
    renderQueue([
      makeIncident({
        evidenceUploading: false,
        evidenceExpectedCount: 2,
        evidenceFailedCount: 1,
      }),
    ]);

    expect(screen.getByText(/⚠ 1 failed/)).toBeTruthy();
  });
});

describe("ActiveQueue — new incident highlight", () => {
  it("badges and animates a row whose id is flagged as new", () => {
    const { container } = renderQueue(
      [makeIncident({ id: "INC-NEW-1" }), makeIncident({ id: "INC-OLD-2" })],
      ["INC-NEW-1"],
    );

    expect(screen.getByText("New Incident")).toBeTruthy();

    const rows = container.querySelectorAll("button.w-full");
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain("animate-pop-in");
    expect(rows[1].className).not.toContain("animate-pop-in");
    expect(screen.getAllByText("New Incident")).toHaveLength(1);
  });

  it("shows no badge or highlight when nothing is new", () => {
    const { container } = renderQueue([makeIncident()]);

    expect(screen.queryByText("New Incident")).toBeNull();
    const row = container.querySelector("button.w-full");
    expect(row.className).not.toContain("animate-pop-in");
  });

  it("keeps evidence badges intact alongside the new badge", () => {
    renderQueue(
      [
        makeIncident({
          id: "INC-EV-1",
          evidenceUploading: true,
          evidence: [{ fileId: "ev-1", url: "" }],
          evidenceExpectedCount: 3,
        }),
      ],
      ["INC-EV-1"],
    );

    expect(screen.getByText("New Incident")).toBeTruthy();
    expect(screen.getByText(/⏳ attaching evidence 1\/3/)).toBeTruthy();
  });
});

describe("ActiveQueue — empty state", () => {
  it("renders the contained empty-state message when the queue is empty", () => {
    renderQueue([]);
    expect(screen.getByText("No incidents in queue.")).toBeTruthy();
  });

  it("keeps the empty-state message filter-aware", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="FLOOD"
        onFilterChange={() => {}}
      />,
    );
    expect(screen.getByText("No flood incidents in queue.")).toBeTruthy();
  });
});
describe("ActiveQueue — loading and error states", () => {
  it("shows skeleton rows instead of the empty message while the first fetch is loading", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        loading
      />,
    );

    expect(screen.queryByText("No incidents in queue.")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading incidents");
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("does not show a misleading pending count while loading", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        loading
      />,
    );

    expect(screen.queryByText("0 Pending")).toBeNull();
    expect(screen.getByText("— Pending")).toBeTruthy();
  });

  it("shows an error message instead of the empty state when the load failed", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        error={new Error("network down")}
      />,
    );

    expect(screen.queryByText("No incidents in queue.")).toBeNull();
    expect(screen.getByText(/couldn't load incidents/i)).toBeTruthy();
  });

  it("keeps the genuine empty message once loading finishes without error", () => {
    renderQueue([]);
    expect(screen.getByText("No incidents in queue.")).toBeTruthy();
  });
});

describe("ActiveQueue — filter chips", () => {
  it("marks the selected chip with aria-pressed", () => {
    renderQueue([makeIncident()]);

    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "FLOOD" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ActiveQueue — long values", () => {
  it("renders a long location in full with no clipping or nowrap classes", () => {
    const LONG_LOCATION =
      "780 Quezon Boulevard Barangay 391, Manila, Philippines";
    renderQueue([makeIncident({ location: LONG_LOCATION })]);

    const location = screen.getByText(LONG_LOCATION);
    expect(location.className).not.toMatch(
      /truncate|whitespace-nowrap|line-clamp/,
    );
  });

  it("keeps category and status rendering unchanged alongside long values", () => {
    renderQueue([
      makeIncident({
        location: "780 Quezon Boulevard Barangay 391, Manila, Philippines",
        category: "CRIME",
        status: "DISPATCHED",
      }),
    ]);

    expect(screen.getByText("CRIME")).toBeTruthy();
    expect(screen.getByText("DISPATCHED")).toBeTruthy();
  });
});
