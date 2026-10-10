import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Skeleton from "../src/components/Skeleton";

describe("Skeleton primitive", () => {
  it("renders an aria-hidden pulsing block merged with the given classes", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);

    const el = container.firstElementChild;
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-24");
  });

  it("carries no accessible name of its own — meaning lives on the wrapping region", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild.textContent).toBe("");
  });
});
