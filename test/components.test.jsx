import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WeatherCard from "../src/components/WeatherCard";
import RiverLevelCard from "../src/components/RiverLevelCard";

const weather = {
  tempC: 30,
  condition: "Partly cloudy",
  humidity: "70%",
  wind: "12 km/h",
  risk: "LOW",
};

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

  it("renders temp, condition, risk badge, and the humidity/wind metrics", () => {
    render(
      <WeatherCard
        loading={false}
        weather={weather}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.getByText("30°C")).toBeTruthy();
    expect(screen.getByText("Partly cloudy")).toBeTruthy();
    expect(screen.getByText("LOW RISK")).toBeTruthy();

    // The old single "Humidity: … | Wind: …" line is now two labeled
    // metric cells — every value it carried is still asserted.
    expect(screen.getByText("Humidity")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("Wind")).toBeTruthy();
    expect(screen.getByText("12 km/h")).toBeTruthy();

    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it("marks its condition glyph decorative and keeps aria-busy on the card", () => {
    const { container } = render(<WeatherCard loading={false} weather={weather} />);

    const card = container.firstElementChild;
    expect(card.getAttribute("aria-busy")).toBe("false");

    const glyph = card.querySelector("svg");
    expect(glyph).toBeTruthy();
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps aria-busy while loading and clears it for the error state", () => {
    const { container, rerender } = render(<WeatherCard loading weather={null} />);
    expect(container.firstElementChild.getAttribute("aria-busy")).toBe("true");

    rerender(
      <WeatherCard loading={false} weather={null} error={new Error("offline")} />,
    );
    expect(container.firstElementChild.getAttribute("aria-busy")).toBe("false");
  });

  it("shows a retryable error state when the fetch failed and no data arrived", () => {
    const onRetry = vi.fn();
    render(
      <WeatherCard
        loading={false}
        weather={null}
        error={new Error("offline")}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Weather data unavailable")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();

    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the last reading on screen when a refresh fails", () => {
    render(
      <WeatherCard
        loading={false}
        weather={weather}
        error={new Error("offline")}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText("30°C")).toBeTruthy();
    expect(screen.getByText(/Update failed/)).toBeTruthy();
    expect(screen.queryByText("Weather data unavailable")).toBeNull();
  });

  it("escalates the badge and tile to the reported risk level", () => {
    const { container } = render(
      <WeatherCard
        loading={false}
        weather={{ ...weather, risk: "HIGH", condition: "Thunderstorm" }}
      />,
    );

    expect(screen.getByText("HIGH RISK")).toBeTruthy();
    expect(container.querySelector(".text-risk-high")).toBeTruthy();
  });
});

describe("WeatherCard — background refresh", () => {
  it("keeps the reading up and shows a Refreshing… cue while refetching", () => {
    render(
      <WeatherCard
        loading
        weather={weather}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.getByText("30°C")).toBeTruthy();
    expect(screen.getByText("Refreshing…")).toBeTruthy();
    expect(screen.queryByText(/^Updated /)).toBeNull();
  });

  it("returns to the Updated timestamp once the refresh settles", () => {
    const { rerender } = render(
      <WeatherCard
        loading
        weather={weather}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    rerender(
      <WeatherCard
        loading={false}
        weather={weather}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.queryByText("Refreshing…")).toBeNull();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });
});

describe("WeatherCard dynamic condition graphics", () => {
  const graphic = (container, key) =>
    container.querySelector(`svg[data-condition="${key}"]`);

  const renderWithCondition = (condition, tempC = 31) => {
    const { container } = render(
      <WeatherCard
        loading={false}
        weather={{
          tempC,
          condition,
          humidity: "82%",
          wind: "12km/h",
          risk: "LOW",
        }}
      />,
    );
    return container;
  };

  // The API only sends condition text (OpenWeather `weather[0].main`,
  // plus the backend's "Partly Cloudy" fallback) — these are the exact
  // values the backend can produce. Mobile maps the same strings to
  // the same semantic keys.
  const CONDITION_CASES = [
    ["Clear", "clear"],
    ["Clouds", "cloud"],
    ["Overcast", "cloud"],
    ["Partly Cloudy", "partly"],
    ["Rain", "rain"],
    ["Drizzle", "drizzle"],
    ["Thunderstorm", "storm"],
    ["Fog", "fog"],
    ["Mist", "fog"],
    ["Haze", "fog"],
    ["Snow", "snow"],
  ];

  for (const [condition, key] of CONDITION_CASES) {
    it(`maps "${condition}" to the ${key} graphic`, () => {
      const container = renderWithCondition(condition);
      expect(graphic(container, key)).toBeTruthy();
    });
  }

  it("renders the small graphic beside a readable temperature and condition text", () => {
    const container = renderWithCondition("Thunderstorm", 31);

    expect(screen.getByText("31°C")).toBeTruthy();
    expect(screen.getByText("Thunderstorm")).toBeTruthy();
    // graphic stays small and inline — it supports the temperature
    // rather than dominating the card.
    expect(graphic(container, "storm")).toBeTruthy();
    expect(
      container.innerHTML.indexOf('data-condition="storm"'),
    ).toBeLessThan(container.innerHTML.indexOf("31°C"));
  });

  it("falls back to the neutral cloud graphic for unknown condition text", () => {
    const container = renderWithCondition("Unrecognized Phenomenon");

    expect(graphic(container, "cloud")).toBeTruthy();
    expect(container.querySelector('svg[data-condition="clear"]')).toBeNull();
    expect(screen.getByText("Unrecognized Phenomenon")).toBeTruthy();
  });

  it("keeps the glyph decorative and risk-tinted per the reported level", () => {
    const { container } = render(
      <WeatherCard
        loading={false}
        weather={{
          tempC: 31,
          condition: "Thunderstorm",
          humidity: "82%",
          wind: "12km/h",
          risk: "HIGH",
        }}
      />,
    );

    const glyph = graphic(container, "storm");
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(glyph.closest(".text-risk-high")).toBeTruthy();
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

  it("fills the severity ladder to the reported status", () => {
    const { container, unmount } = render(
      <RiverLevelCard loading={false} river={{ levelM: 15.6, status: "Alert" }} />,
    );

    expect(screen.getByText("Alert")).toBeTruthy();
    // 4 segments; Normal + Alert are lit for an "Alert" reading. The
    // badge's tinted classes (bg-risk-mid/15) don't match .bg-risk-mid.
    expect(container.querySelectorAll(".bg-risk-mid").length).toBe(2);
    unmount();

    const { container: normalContainer } = render(
      <RiverLevelCard loading={false} river={{ levelM: 14.1, status: "Normal" }} />,
    );
    expect(normalContainer.querySelectorAll(".bg-flood").length).toBe(1);
  });

  it("shows the API's alert note and feed provenance when provided", () => {
    render(
      <RiverLevelCard
        loading={false}
        river={{
          levelM: 15.2,
          status: "Normal",
          alertLevel: "Alert Level 1 begins at 15m",
          source: "pagasa",
        }}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.getByText("Alert Level 1 begins at 15m")).toBeTruthy();
    expect(screen.getByText("PAGASA feed")).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it("flags a degraded fallback reading instead of implying live data", () => {
    render(
      <RiverLevelCard
        loading={false}
        river={{ levelM: 15.2, status: "Normal", source: "mock" }}
      />,
    );

    expect(screen.getByText("Fallback data")).toBeTruthy();
  });

  it("shows a retryable error state when the fetch failed", () => {
    const onRetry = vi.fn();
    render(
      <RiverLevelCard
        loading={false}
        river={null}
        error={new Error("offline")}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("River data unavailable")).toBeTruthy();

    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("stays aria-busy while loading", () => {
    const { container } = render(<RiverLevelCard loading river={null} />);
    expect(container.firstElementChild.getAttribute("aria-busy")).toBe("true");
  });
});

describe("RiverLevelCard — background refresh", () => {
  it("keeps the level up and shows a Refreshing… cue while refetching", () => {
    render(
      <RiverLevelCard
        loading
        river={{ levelM: 15.2, status: "Normal", source: "pagasa" }}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.getByText("15.2m")).toBeTruthy();
    expect(screen.getByText("Refreshing…")).toBeTruthy();
    expect(screen.getByText("PAGASA feed")).toBeTruthy();
    expect(screen.queryByText(/^Updated /)).toBeNull();
  });

  it("returns to the Updated timestamp once the refresh settles", () => {
    const { rerender } = render(
      <RiverLevelCard
        loading
        river={{ levelM: 15.2, status: "Normal" }}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    rerender(
      <RiverLevelCard
        loading={false}
        river={{ levelM: 15.2, status: "Normal" }}
        updatedAt="2026-10-06T14:32:00.000Z"
      />,
    );

    expect(screen.queryByText("Refreshing…")).toBeNull();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });
});
