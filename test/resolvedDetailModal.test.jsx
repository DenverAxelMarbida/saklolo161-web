import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ResolvedDetailModal from "../src/components/ResolvedDetailModal";

vi.mock("../src/components/MiniIncidentMap", () => ({
  default: () => <div data-testid="mini-incident-map" />,
}));

function makeIncident(overrides = {}) {
  return {
    id: "FIRE-24-0001",
    category: "FIRE",
    location: "Sto. Nino, Marikina City",
    callerNotes: "Heavy smoke reported.",
    coords: { lat: 14.6395, lng: 121.108 },
    evidence: [],
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("ResolvedDetailModal evidence", () => {
  it("renders without an evidence block when there is no evidence", () => {
    render(<ResolvedDetailModal incident={makeIncident()} onClose={() => {}} />);

    expect(screen.getByText("Heavy smoke reported.")).toBeTruthy();
    expect(screen.queryByText(/evidence file/)).toBeNull();
  });

  it("renders image and video previews plus an evidence caption", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({
          evidence: [
            { fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg", uploadedAt: "t" },
            { fileId: "b", url: "https://cdn.example/b.mp4", mimeType: "video/mp4", uploadedAt: "t" },
          ],
        })}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("2 evidence files")).toBeTruthy();

    const img = screen.getByAltText("Incident evidence");
    expect(img.getAttribute("src")).toContain("a.jpg");

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.getAttribute("src")).toContain("b.mp4");
  });

  it("skips evidence entries with an empty url (pre-Storage cutover) gracefully", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({
          evidence: [
            { fileId: "a", url: "", mimeType: "image/jpeg", uploadedAt: "t" },
            { fileId: "b", url: "https://cdn.example/b.png", mimeType: "image/png", uploadedAt: "t" },
          ],
        })}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("1 evidence file")).toBeTruthy();

    const previews = document.querySelectorAll("img[src], video[src]");
    expect(previews).toHaveLength(1);
    expect(previews[0].getAttribute("src")).toContain("b.png");
  });
});