import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ControlRoom from "../src/components/ControlRoom";
import { CATEGORY_KEYS } from "../src/lib/config";

// The chip row is rendered by ControlRoom itself (always-visible
// Resolved tab chrome, next to the search input — outside
// ResolvedLog's scroll container), so these tests mount the REAL
// ControlRoom + REAL ResolvedLog and only stub the heavy siblings.
vi.mock("../src/components/WeatherCard", () => ({ default: () => null }));
vi.mock("../src/components/RiverLevelCard", () => ({ default: () => null }));
vi.mock("../src/components/IncidentMap", () => ({ default: () => null }));
vi.mock("../src/components/MiniIncidentMap", () => ({
  default: () => <div data-testid="mini-map" />,
}));
// ActiveQueue is stubbed but still surfaces the shared activeFilter so
// these tests can prove the resolved chips never touch it.
vi.mock("../src/components/ActiveQueue", () => ({
  default: ({ activeFilter }) => (
    <div data-testid="active-queue-mock">{activeFilter}</div>
  ),
}));
vi.mock("../src/hooks/useWeatherRiver", () => ({
  useWeatherRiver: () => ({ weather: null, river: null, loading: false }),
}));

function makeResolved(overrides = {}) {
  return {
    id: "INC-1",
    category: "FLOOD",
    status: "RESOLVED",
    priority: "MEDIUM",
    location: "Marikina City",
    coords: { lat: 14.65, lng: 121.1 },
    callerNotes: "",
    evidence: [],
    station: null,
    dispatch: null,
    resolvedAt: "2026-10-01T08:00:00.000Z",
    elapsedMinutes: 60,
    ...overrides,
  };
}

const FIRE = makeResolved({
  id: "INC-FIRE",
  category: "FIRE",
  resolvedAt: "2026-10-03T08:00:00.000Z",
});
const MEDICAL = makeResolved({
  id: "INC-MEDICAL",
  category: "MEDICAL",
  resolvedAt: "2026-10-02T08:00:00.000Z",
});
const FLOOD = makeResolved({
  id: "INC-FLOOD",
  category: "FLOOD",
  resolvedAt: "2026-10-01T08:00:00.000Z",
});
const CRIME = makeResolved({
  id: "INC-CRIME",
  category: "CRIME",
  resolvedAt: "2026-09-30T08:00:00.000Z",
});
const ALL_FOUR = [FIRE, MEDICAL, FLOOD, CRIME];

function renderRoom({ incidents = [], initialAgency = "ALL", loading = false, error = null } = {}) {
  return render(
    <ControlRoom
      incidents={incidents}
      onSelectIncident={() => {}}
      initialAgency={initialAgency}
      loading={loading}
      error={error}
    />,
  );
}

function openResolvedTab() {
  fireEvent.click(screen.getByRole("button", { name: "Resolved" }));
}

function rowIds() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.textContent.startsWith("#"))
    .map((button) => button.textContent);
}

describe("Resolved tab category chips — always visible (ControlRoom chrome)", () => {
  it("renders the full chip set when the resolved list is empty", () => {
    renderRoom({ incidents: [] });
    openResolvedTab();

    for (const key of ["ALL", ...CATEGORY_KEYS]) {
      expect(screen.getByTestId(`resolved-category-${key}`)).toBeTruthy();
    }
    expect(
      screen.getByTestId("resolved-category-ALL").getAttribute("aria-pressed"),
    ).toBe("true");
    // The list itself is genuinely empty — only the chips carry over.
    expect(screen.getByText("No resolved incidents yet.")).toBeTruthy();
  });

  it("renders the chips while the incident feed is still loading", () => {
    renderRoom({ incidents: [], loading: true });
    openResolvedTab();

    expect(screen.getByTestId("resolved-category-ALL")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders the chips when the incident feed failed to load", () => {
    renderRoom({ incidents: [], error: new Error("network down") });
    openResolvedTab();

    expect(screen.getByTestId("resolved-category-ALL")).toBeTruthy();
    expect(screen.getByText(/couldn't load resolved incidents/i)).toBeTruthy();
  });

  it("keeps the chips visible when filters exclude every row, so one click resets", () => {
    renderRoom({ incidents: ALL_FOUR });
    openResolvedTab();

    fireEvent.click(screen.getByTestId("resolved-category-CRIME"));
    fireEvent.change(screen.getByPlaceholderText("Search resolved..."), {
      target: { value: "zzz" },
    });

    expect(
      screen.getByText("No resolved incidents match your filters."),
    ).toBeTruthy();
    // The chips are still there — category and search are independent,
    // so clicking ALL resets the category while the search still hides
    // the rows until it is cleared.
    fireEvent.click(screen.getByTestId("resolved-category-ALL"));
    expect(
      screen.getByTestId("resolved-category-ALL").getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.change(screen.getByPlaceholderText("Search resolved..."), {
      target: { value: "" },
    });
    expect(rowIds()).toHaveLength(4);
  });
});

describe("Resolved tab category chips — filtering + Active-tab isolation", () => {
  it("ALL lists every resolved incident in resolvedAt order; each category narrows to one", () => {
    renderRoom({ incidents: ALL_FOUR });
    openResolvedTab();

    const rows = rowIds();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain("INC-FIRE");
    expect(rows[1]).toContain("INC-MEDICAL");
    expect(rows[2]).toContain("INC-FLOOD");
    expect(rows[3]).toContain("INC-CRIME");

    const cases = [
      ["MEDICAL", "INC-MEDICAL"],
      ["FIRE", "INC-FIRE"],
      ["FLOOD", "INC-FLOOD"],
      ["CRIME", "INC-CRIME"],
    ];
    for (const [chip, id] of cases) {
      fireEvent.click(screen.getByTestId(`resolved-category-${chip}`));
      const filtered = rowIds();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toContain(id);
    }

    fireEvent.click(screen.getByTestId("resolved-category-ALL"));
    expect(rowIds()).toHaveLength(4);
  });

  it("combines category filtering with the search input", () => {
    renderRoom({ incidents: ALL_FOUR });
    openResolvedTab();

    fireEvent.click(screen.getByTestId("resolved-category-FIRE"));
    expect(rowIds()).toHaveLength(1);
    expect(rowIds()[0]).toContain("INC-FIRE");

    // Search narrows INSIDE the Fire category.
    fireEvent.change(screen.getByPlaceholderText("Search resolved..."), {
      target: { value: "INC-MED" },
    });
    expect(
      screen.getByText("No resolved incidents match your filters."),
    ).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search resolved..."), {
      target: { value: "inc-fire" },
    });
    expect(rowIds()).toHaveLength(1);
    expect(rowIds()[0]).toContain("INC-FIRE");

    // Category persists while the search is edited.
    fireEvent.change(screen.getByPlaceholderText("Search resolved..."), {
      target: { value: "" },
    });
    expect(rowIds()).toHaveLength(1);
    expect(rowIds()[0]).toContain("INC-FIRE");
  });

  it("resolved chip clicks never change the shared queue/map filter or the open tab", () => {
    renderRoom({ incidents: ALL_FOUR, initialAgency: "FLOOD" });
    openResolvedTab();

    // Agency default applies to the queue/map only — resolved opens ALL.
    fireEvent.click(screen.getByTestId("resolved-category-FIRE"));
    expect(rowIds()).toHaveLength(1);
    expect(rowIds()[0]).toContain("INC-FIRE");

    // Still on the Resolved tab; ActiveQueue isn't even mounted here
    // (ControlRoom swaps the rail content per tab).
    expect(
      screen.getByRole("button", { name: "Resolved" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByTestId("active-queue-mock")).toBeNull();
    expect(screen.getByPlaceholderText("Search resolved...")).toBeTruthy();

    // Switching to Active shows the untouched agency filter — the
    // resolved chips never touched the shared activeFilter.
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByTestId("active-queue-mock").textContent).toBe("FLOOD");
  });

  it("leaves the Active tab unchanged after resolved-filter interactions", () => {
    renderRoom({ incidents: ALL_FOUR });
    openResolvedTab();

    fireEvent.click(screen.getByTestId("resolved-category-MEDICAL"));
    fireEvent.click(screen.getByRole("button", { name: "Active" }));

    expect(
      screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("active-queue-mock").textContent).toBe("ALL");
    // Resolved-only chrome is gone while the Active tab is open.
    expect(screen.queryByTestId("resolved-category-ALL")).toBeNull();
  });
});
