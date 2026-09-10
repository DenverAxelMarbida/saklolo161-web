import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TriageModal from "../src/components/TriageModal";

vi.mock("../src/components/MiniIncidentMap", () => ({
  default: () => <div data-testid="mini-map" />,
}));

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
    station: null,
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("TriageModal", () => {
  it("renders backend-shaped evidence records as pills without crashing", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "",
          mimeType: "video/mp4",
          sizeKb: 24512,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          fileId: "ev-2",
          url: "",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:01.000Z",
        },
      ],
    });

    render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByText(/📎 Video · 24512 KB/)).toBeTruthy();
    expect(screen.getByText(/📎 Photo · 900 KB/)).toBeTruthy();
    expect(screen.getByText("Water rising near the bridge.")).toBeTruthy();
  });

  it("renders image and video elements for truthy evidence urls", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-img",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-img/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          fileId: "ev-vid",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-vid/media",
          mimeType: "video/mp4",
          sizeKb: 24512,
          uploadedAt: "2026-09-10T12:00:01.000Z",
        },
      ],
    });

    const { container } = render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "http://localhost:5000/api/incidents/x/evidence/ev-img/media",
    );
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "http://localhost:5000/api/incidents/x/evidence/ev-vid/media",
    );
  });

  it("still renders legacy string evidence", () => {
    const incident = makeIncident({ evidence: ["photo.jpg"] });

    render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByText(/📎 photo\.jpg/)).toBeTruthy();
  });

  it("renders with no evidence", () => {
    render(
      <TriageModal
        incident={makeIncident()}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.queryByText(/📎/)).toBeNull();
    expect(screen.getByText("Water rising near the bridge.")).toBeTruthy();
  });
});