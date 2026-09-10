import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WeatherCard from "../src/components/WeatherCard";
import RiverLevelCard from "../src/components/RiverLevelCard";

describe("WeatherCard", () => {
  it("shows a placeholder while loading", () => {
    render(<WeatherCard loading weather={null} />);

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByText(/—°C/)).toBeTruthy();
    expect(screen.queryByText(/RISK/)).toBeNull();
  });

  it("shows the loading placeholder when data is missing even if not flagged loading", () => {
    render(<WeatherCard loading={false} weather={null} />);

    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders temp, condition, risk badge, and the humidity/wind line", () => {
    render(
      <WeatherCard
        loading={false}
        weather={{
          tempC: 30,
          condition: "Partly cloudy",
          humidity: "70%",
          wind: "12 km/h",
          risk: "LOW",
        }}
      />,
    );

    expect(screen.getByText("30°C")).toBeTruthy();
    expect(screen.getByText("Partly cloudy")).toBeTruthy();
    expect(screen.getByText("LOW RISK")).toBeTruthy();
    expect(screen.getByText(/Humidity: 70% \| Wind: 12 km\/h/)).toBeTruthy();
  });
});

describe("RiverLevelCard", () => {
  it("shows a placeholder while loading", () => {
    render(<RiverLevelCard loading river={null} />);

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByText(/—m/)).toBeTruthy();
  });

  it("renders the live level and status badge, with no sparkline chart", () => {
    const { container } = render(
      <RiverLevelCard loading={false} river={{ levelM: 15.2, status: "Normal" }} />,
    );

    expect(screen.getByText("15.2m")).toBeTruthy();
    expect(screen.getByText("Normal")).toBeTruthy();
    // The card renders a number, not the (unused) sparkline series.
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});