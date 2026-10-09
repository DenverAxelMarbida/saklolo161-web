import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("shows the server-recorded last upload time from uploadedAt", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({
          evidence: [
            { fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg", uploadedAt: "2026-09-10T12:00:00.000Z" },
            { fileId: "b", url: "", mimeType: "image/png", uploadedAt: "2026-09-11T08:30:00.000Z" },
          ],
        })}
        onClose={() => {}}
      />,
    );

    const el = screen.getByTestId("last-uploaded");
    expect(el.textContent).toMatch(/^Last uploaded /);
    // Latest of the two uploadedAt values wins.
    expect(el.textContent).toContain("Sep 11, 2026");
  });
  it("degrades empty-url entries to a pill instead of skipping them", () => {
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

    expect(screen.getByText("2 evidence files")).toBeTruthy();
    expect(screen.getByText("📎 Photo · 0 KB")).toBeTruthy();

    const previews = document.querySelectorAll("img[src], video[src]");
    expect(previews).toHaveLength(1);
    expect(previews[0].getAttribute("src")).toContain("b.png");
  });
});

describe("ResolvedDetailModal — dialog dismissal", () => {
  it("is a labelled dialog that closes on Escape", () => {
    const onClose = vi.fn();
    render(<ResolvedDetailModal incident={makeIncident()} onClose={onClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
describe("ResolvedDetailModal — citizen contact and resilient text", () => {
  it("renders the canonical citizen phone number", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({ citizenPhone: "+639171234567" })}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Phone Number")).toBeTruthy();
    expect(screen.getByText("+639171234567")).toBeTruthy();
  });

  it("renders a graceful dash when no phone number was stored", () => {
    render(<ResolvedDetailModal incident={makeIncident()} onClose={() => {}} />);

    const heading = screen.getByText("Phone Number");
    expect(heading.nextElementSibling.textContent).toBe("—");
  });

  it("renders long location and station values in full without clipping classes", () => {
    const LONG_LOCATION =
      "780 Quezon Boulevard Barangay 391, Manila, Philippines";
    const LONG_STATION =
      "Marikina City Disaster Risk Reduction Management Office";
    render(
      <ResolvedDetailModal
        incident={makeIncident({
          location: LONG_LOCATION,
          dispatch: { stationName: LONG_STATION, assignedUnit: "Rescue 161 Ambulance #1" },
        })}
        onClose={() => {}}
      />,
    );

    const location = screen.getByText(LONG_LOCATION);
    const station = screen.getByText(LONG_STATION);
    for (const node of [location, station]) {
      expect(node.className).not.toMatch(/truncate|whitespace-nowrap|line-clamp/);
    }
    expect(screen.getByText("Rescue 161 Ambulance #1")).toBeTruthy();
  });
});

describe("ResolvedDetailModal — resolution timestamp", () => {
  const RESOLVED_ISO = "2025-06-15T11:30:00.000Z";
  const formatResolved = (iso) =>
    new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  it("renders the actual resolution timestamp instead of 'N/A'", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({ resolvedAt: RESOLVED_ISO })}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText("N/A")).toBeNull();
    const heading = screen.getByText("Resolved");
    expect(heading.nextElementSibling.textContent).toBe(
      formatResolved(RESOLVED_ISO),
    );
  });

  it("renders a graceful dash (not 'N/A') when no resolution time was stored", () => {
    render(<ResolvedDetailModal incident={makeIncident()} onClose={() => {}} />);

    expect(screen.queryByText("N/A")).toBeNull();
    const heading = screen.getByText("Resolved");
    expect(heading.nextElementSibling.textContent).toBe("—");
  });
});

describe("ResolvedDetailModal — missing evidence bytes (served 404)", () => {
  it("degrades a failed media preview to its labeled pill instead of a broken frame", () => {
    render(
      <ResolvedDetailModal
        incident={makeIncident({
          evidence: [
            {
              fileId: "gone",
              url: "https://cdn.example/gone.jpg",
              mimeType: "image/jpeg",
              sizeKb: 762,
              uploadedAt: "t",
            },
          ],
        })}
        onClose={() => {}}
      />,
    );

    // The record renders as a real preview first...
    const img = screen.getByAltText("Incident evidence");
    // ...but when the server can no longer serve the bytes (ephemeral
    // disk loss after a redeploy), the <img> fires an error event.
    fireEvent.error(img);

    // The preview is replaced by the established pill design — the
    // record stays visible with its label instead of a broken image.
    expect(screen.queryByAltText("Incident evidence")).toBeNull();
    expect(screen.getByText(/Photo · 762 KB/)).toBeTruthy();
    expect(screen.getByText("1 evidence file")).toBeTruthy();
  });
});
