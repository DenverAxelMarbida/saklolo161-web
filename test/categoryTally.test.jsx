import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryTally from "../src/components/CategoryTally";
import ControlRoom from "../src/components/ControlRoom";
import { CATEGORY_KEYS, CATEGORIES } from "../src/lib/config";

// ControlRoom renders the map/queue/weather stack too — irrelevant here
// and heavy (mapbox), so stub the siblings and keep the tally wiring real.
vi.mock("../src/components/WeatherCard", () => ({ default: () => null }));
vi.mock("../src/components/RiverLevelCard", () => ({ default: () => null }));
vi.mock("../src/components/IncidentMap", () => ({ default: () => null }));
vi.mock("../src/components/ActiveQueue", () => ({ default: () => null }));
vi.mock("../src/components/ResolvedLog", () => ({ default: () => null }));
vi.mock("../src/hooks/useWeatherRiver", () => ({
  useWeatherRiver: () => ({ weather: null, river: null, loading: false }),
}));

function renderTally({
  incidents = [],
  agency,
  activeFilter = "ALL",
  onSelectFilter = vi.fn(),
} = {}) {
  const utils = render(
    <CategoryTally
      incidents={incidents}
      activeFilter={activeFilter}
      onSelectFilter={onSelectFilter}
      agency={agency}
    />,
  );
  return { ...utils, onSelectFilter };
}

// Category cards are the only buttons whose first child is a <div>
// (ControlRoom's view tabs are text-only and get skipped here).
function visibleLabels(container) {
  return [...container.querySelectorAll("button")]
    .map((button) => button.querySelector(":scope > div"))
    .filter(Boolean)
    .map((div) => div.textContent);
}

describe("CategoryTally — agency-specific cards", () => {
  it.each(["FLOOD", "FIRE", "MEDICAL", "CRIME"])(
    "%s agency sees only the %s card",
    (agency) => {
      const { container } = renderTally({ agency });

      expect(visibleLabels(container)).toEqual([CATEGORIES[agency].label]);
      expect(screen.getByText(CATEGORIES[agency].label)).toBeTruthy();
      for (const key of CATEGORY_KEYS) {
        if (key !== agency) {
          expect(screen.queryByText(CATEGORIES[key].label)).toBeNull();
        }
      }
    },
  );

  it("normalizes lowercase agency input", () => {
    const { container } = renderTally({ agency: "flood" });
    expect(visibleLabels(container)).toEqual([CATEGORIES.FLOOD.label]);
  });

  it("trims stray whitespace around the agency value", () => {
    const { container } = renderTally({ agency: "  FIRE  " });
    expect(visibleLabels(container)).toEqual([CATEGORIES.FIRE.label]);
  });

  it("ALL agency sees every category card", () => {
    const { container } = renderTally({ agency: "ALL" });
    expect(visibleLabels(container)).toEqual(
      CATEGORY_KEYS.map((key) => CATEGORIES[key].label),
    );
  });

  it("missing agency falls back to the full card set (existing safe default)", () => {
    const { container } = renderTally({ agency: undefined });
    expect(visibleLabels(container)).toEqual(
      CATEGORY_KEYS.map((key) => CATEGORIES[key].label),
    );
  });

  it("unknown agency falls back to the full card set, never a single restricted card", () => {
    const { container } = renderTally({ agency: "XYZ" });
    expect(visibleLabels(container)).toEqual(
      CATEGORY_KEYS.map((key) => CATEGORIES[key].label),
    );
  });
});

describe("CategoryTally — counts and filter behavior (unchanged)", () => {
  const incidents = [
    { category: "FLOOD", status: "PENDING" },
    { category: "FLOOD", status: "RESOLVED" },
    { category: "FIRE", status: "DISPATCHED" },
    { category: "MEDICAL", status: "EN ROUTE" },
    { category: "CRIME", status: "PENDING" },
  ];

  it("computes per-category counts of non-resolved incidents for the visible cards", () => {
    const { container } = renderTally({ incidents, agency: "ALL" });

    const buttons = [...container.querySelectorAll("button")];
    const countFor = (label) => {
      const button = buttons.find(
        (b) => b.querySelector("div").textContent === label,
      );
      return button.querySelectorAll("div")[1].textContent;
    };

    // RESOLVED flood incident excluded; everything else counted.
    expect(countFor("FLOOD")).toBe("01");
    expect(countFor("FIRE")).toBe("01");
    expect(countFor("MEDICAL")).toBe("01");
    expect(countFor("CRIME")).toBe("01");
  });

  it("keeps the count correct for a restricted agency's card", () => {
    const { container } = renderTally({ incidents, agency: "FLOOD" });
    const button = container.querySelector("button");
    expect(button.querySelectorAll("div")[1].textContent).toBe("01");
  });

  it("clicking a card selects that category filter", () => {
    const { container, onSelectFilter } = renderTally({ agency: "ALL" });
    const floodCard = [...container.querySelectorAll("button")].find(
      (b) => b.querySelector("div").textContent === "FLOOD",
    );

    fireEvent.click(floodCard);
    expect(onSelectFilter).toHaveBeenCalledWith("FLOOD");
  });

  it("clicking the active card still clears the filter to ALL (toggle preserved)", () => {
    const { onSelectFilter } = renderTally({
      agency: "FLOOD",
      activeFilter: "FLOOD",
    });

    fireEvent.click(screen.getByText("FLOOD"));
    expect(onSelectFilter).toHaveBeenCalledWith("ALL");
  });
});

describe("CategoryTally — presentation", () => {
  it("labels the grid with a section heading", () => {
    renderTally({ agency: "ALL" });
    expect(
      screen.getByRole("heading", { name: "Incident Categories" }),
    ).toBeTruthy();
  });

  it("a restricted agency's single card spans the full row instead of half a 2-col grid", () => {
    const { container } = renderTally({ agency: "FLOOD" });
    const grid = container.querySelector("button").parentElement;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).not.toContain("grid-cols-2");
  });

  it("the full card set keeps the two-column grid", () => {
    const { container } = renderTally({ agency: "ALL" });
    const grid = container.querySelector("button").parentElement;
    expect(grid.className).toContain("grid-cols-2");
  });

  it("marks the active category card with aria-pressed", () => {
    renderTally({ agency: "ALL", activeFilter: "FLOOD" });

    expect(
      screen.getByRole("button", { name: /^FLOOD/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /^FIRE/ }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

describe("ControlRoom wiring", () => {
  it("passes the dispatcher's agency down so the tally restricts the cards", () => {
    const { container } = render(
      <ControlRoom
        incidents={[]}
        onSelectIncident={() => {}}
        initialAgency="FLOOD"
      />,
    );

    expect(visibleLabels(container)).toEqual([CATEGORIES.FLOOD.label]);
  });

  it("keeps the full card set for an ALL/admin account", () => {
    const { container } = render(
      <ControlRoom
        incidents={[]}
        onSelectIncident={() => {}}
        initialAgency="ALL"
      />,
    );

    expect(visibleLabels(container)).toEqual(
      CATEGORY_KEYS.map((key) => CATEGORIES[key].label),
    );
  });

  it("stacks to a single column on narrow viewports and restores the three-column desk at xl", () => {
    const { container } = render(
      <ControlRoom
        incidents={[]}
        onSelectIncident={() => {}}
        initialAgency="ALL"
      />,
    );

    const grid = container.firstElementChild;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("xl:grid-cols-[280px_1fr_320px]");
    expect(grid.className).toContain("xl:overflow-hidden");
  });

  it("exposes the Active/Resolved view switch as aria-pressed toggle buttons", () => {
    render(
      <ControlRoom
        incidents={[]}
        onSelectIncident={() => {}}
        initialAgency="ALL"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Resolved" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
