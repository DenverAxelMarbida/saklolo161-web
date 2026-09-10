import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import WeatherCard from "./WeatherCard";

vi.mock("../lib/api", () => ({ getWeatherRiver: vi.fn() }));
import { getWeatherRiver } from "../lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WeatherCard", () => {
  it("renders the mock fallback values while the fetch is pending (loading state)", () => {
    getWeatherRiver.mockImplementation(() => new Promise(() => {}));

    render(<WeatherCard />);

    expect(screen.getByText("28°C")).toBeInTheDocument();
    expect(screen.getByText("Partly Cloudy")).toBeInTheDocument();
    expect(screen.getByText("LOW RISK")).toBeInTheDocument();
  });

  it("renders the fetched weather once it resolves (data state)", async () => {
    let resolveFetch;
    getWeatherRiver.mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );

    render(<WeatherCard />);
    expect(screen.getByText("28°C")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ weather: { tempC: 31, condition: "Thunderstorms", risk: "HIGH" } });
    });

    expect(screen.getByText("31°C")).toBeInTheDocument();
    expect(screen.getByText("Thunderstorms")).toBeInTheDocument();
    expect(screen.getByText("HIGH RISK")).toBeInTheDocument();
  });

  it("keeps the mock fallback when the fetch fails (graceful degradation)", async () => {
    getWeatherRiver.mockRejectedValueOnce(new Error("backend down"));

    render(<WeatherCard />);

    expect(await screen.findByText("28°C")).toBeInTheDocument();
    expect(screen.getByText("LOW RISK")).toBeInTheDocument();
  });
});