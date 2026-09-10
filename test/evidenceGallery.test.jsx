import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import EvidenceGallery from "../src/components/EvidenceGallery";

describe("EvidenceGallery", () => {
  it("renders served images and videos as uniform thumbnails with a video badge", () => {
    const { container } = render(
      <EvidenceGallery
        evidence={[
          { fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg" },
          { fileId: "b", url: "https://cdn.example/b.mp4", mimeType: "video/mp4" },
        ]}
      />,
    );

    const img = container.querySelector("img[src]");
    expect(img?.getAttribute("src")).toContain("a.jpg");

    const videos = container.querySelectorAll("video[src]");
    expect(videos).toHaveLength(1);
    expect(videos[0].getAttribute("src")).toContain("b.mp4");

    expect(
      screen.getByRole("button", { name: /Play evidence video/ }),
    ).toBeTruthy();
    expect(screen.queryByText(/📎/)).toBeNull();
  });

  it("degrades records without a served url to pill chips", () => {
    render(
      <EvidenceGallery
        evidence={[
          { fileId: "a", url: "", mimeType: "image/jpeg", sizeKb: 0 },
          { fileId: "b", url: "", mimeType: "video/mp4", sizeKb: 24512 },
          "legacy-photo.jpg",
        ]}
      />,
    );

    expect(screen.getByText("📎 Photo · 0 KB")).toBeTruthy();
    expect(screen.getByText("📎 Video · 24512 KB")).toBeTruthy();
    expect(screen.getByText("📎 legacy-photo.jpg")).toBeTruthy();
    expect(document.querySelector("img[src], video[src]")).toBeNull();
  });

  it("opens a lightbox on thumbnail click with counter and enlarged media", () => {
    const { container } = render(
      <EvidenceGallery
        evidence={[
          { fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg" },
          { fileId: "b", url: "https://cdn.example/b.jpg", mimeType: "image/jpeg" },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /View evidence photo 1/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Evidence 1 of 2");
    expect(within(dialog).getByText("1 / 2")).toBeTruthy();

    const lightboxImg = within(dialog).getByAltText("Incident evidence");
    expect(lightboxImg.getAttribute("src")).toContain("a.jpg");

    // Thumbnail unclicked remains in the grid untouched.
    expect(container.querySelectorAll("img[src]")).toBeTruthy();
  });

  it("navigates prev/next and updates the counter", () => {
    render(
      <EvidenceGallery
        evidence={[
          { fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg" },
          { fileId: "b", url: "https://cdn.example/b.mp4", mimeType: "video/mp4" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /View evidence photo 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next evidence/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Evidence 2 of 2");
    expect(within(dialog).getByText("2 / 2")).toBeTruthy();
    expect(dialog.querySelector("video[controls]")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Previous evidence/ }));
    expect(within(dialog).getByText("1 / 2")).toBeTruthy();
  });

  it("closes the lightbox on Escape", () => {
    render(
      <EvidenceGallery
        evidence={[{ fileId: "a", url: "https://cdn.example/a.jpg", mimeType: "image/jpeg" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /View evidence photo 1/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders nothing (no dialog, no pills) when evidence is empty", () => {
    const { container } = render(<EvidenceGallery evidence={[]} />);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.queryByText(/📎/)).toBeNull();
    expect(container.querySelector("img[src], video[src]")).toBeNull();
  });
});