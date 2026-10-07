import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("renders an evidence progress banner while uploads are still inbound", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      evidenceUploading: true,
      evidenceExpectedCount: 3,
      evidenceFailedCount: 0,
    });

    const { container } = render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByText(/Attaching evidence 1\/3/)).toBeTruthy();
    const progress = container.querySelector(".bg-risk-mid.transition-all");
    expect(progress).toBeTruthy();
    expect(progress.style.width).toBe(`${(1 / 3) * 100}%`);
  });

  it("shows the retry attempt line during an automatic retry, never a fake byte %", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      evidenceUploading: true,
      evidenceExpectedCount: 3,
      evidenceAttempt: 2,
      evidenceAttemptsTotal: 3,
    });

    const { container } = render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByText(/Evidence retrying — attempt 2\/3/)).toBeTruthy();
    // File-count bar only: no percent text anywhere in the modal.
    expect(container.textContent).not.toMatch(/d+%/);
    expect(screen.queryByTestId("evidence-done")).toBeNull();
  });

  it("confirms when every expected attachment has uploaded", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          fileId: "ev-2",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-2/media",
          mimeType: "image/jpeg",
          sizeKb: 700,
          uploadedAt: "2026-09-10T12:01:00.000Z",
        },
      ],
      evidenceUploading: false,
      evidenceExpectedCount: 2,
      evidenceFailedCount: 0,
    });

    render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByTestId("evidence-done").textContent).toBe(
      "✓ 2 attachments uploaded"
    );
  });
  it("warns when some attachments failed after the upload loop finished", () => {
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
      ],
      evidenceUploading: false,
      evidenceExpectedCount: 3,
      evidenceFailedCount: 2,
    });

    render(
      <TriageModal
        incident={incident}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    expect(screen.getByText(/2 attachments failed to upload/)).toBeTruthy();
    expect(screen.queryByText(/Attaching evidence/)).toBeNull();
  });

  it("dialog card uses the shared pop-in entrance animation", () => {
    const { container } = render(
      <TriageModal
        incident={makeIncident()}
        onClose={() => {}}
        onDispatched={() => {}}
      />,
    );

    const animated = container.querySelector(".animate-pop-in");
    expect(animated).toBeTruthy();
    expect(animated.className).toContain("max-w-3xl");
  });

  it("is a labelled dialog that takes focus on open, closes on Escape, and gives Close a full-size target", () => {
    const onClose = vi.fn();
    const { container } = render(
      <TriageModal
        incident={makeIncident()}
        onClose={onClose}
        onDispatched={() => {}}
      />,
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("h-8");
    expect(close.className).toContain("w-8");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape closes the nested evidence lightbox first, then the dialog itself", () => {
    const onClose = vi.fn();
    const incident = makeIncident({
      evidence: [
        {
          fileId: "ev-1",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-1/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:00.000Z",
        },
        {
          fileId: "ev-2",
          url: "http://localhost:5000/api/incidents/x/evidence/ev-2/media",
          mimeType: "image/jpeg",
          sizeKb: 900,
          uploadedAt: "2026-09-10T12:00:01.000Z",
        },
      ],
    });
    render(
      <TriageModal incident={incident} onClose={onClose} onDispatched={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /View evidence photo 1/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});