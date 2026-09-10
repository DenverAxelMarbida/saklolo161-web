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
    station: null,
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

function renderQueue(incidents) {
  return render(
    <ActiveQueue
      incidents={incidents}
      onSelectIncident={() => {}}
      activeFilter="ALL"
      onFilterChange={() => {}}
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