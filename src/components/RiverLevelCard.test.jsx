import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import RiverLevelCard from "./RiverLevelCard";

vi.mock("../lib/api", () => ({ getWeatherRiver: vi.fn() }));
import { getWeatherRiver } from "../lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RiverLevelCard", () => {
  it("renders the mock fallback river values while the fetch is pending (loading state)", () => {
    getWeatherRiver.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<RiverLevelCard />);

    expect(screen.getByText("15.2m")).toBeInTheDocument();
    expect(screen.getByText("NORMAL")).toBeInTheDocument();
    // Placeholder flat sparkline renders even before live data arrives.
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });

  it("renders the fetched river level/status once it resolves (data state)", async () => {
    let resolveFetch;
    getWeatherRiver.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );

    const { container } = render(<RiverLevelCard />);
    expect(screen.getByText("15.2m")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({
        river: {
          levelM: 16.4,
          status: "ALERT",
          sparkline: [16.0, 16.2, 16.4, 16.4, 16.3],
        },
      });
    });

    expect(screen.getByText("16.4m")).toBeInTheDocument();
    expect(screen.getByText("ALERT")).toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });

  it("keeps the mock fallback when the fetch fails (graceful degradation)", async () => {
    getWeatherRiver.mockRejectedValueOnce(new Error("backend down"));

    render(<RiverLevelCard />);

    expect(await screen.findByText("15.2m")).toBeInTheDocument();
    expect(screen.getByText("NORMAL")).toBeInTheDocument();
  });
});