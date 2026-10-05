import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import IncidentMap from "../src/components/IncidentMap";

const { state } = vi.hoisted(() => ({
  state: {
    markers: [],
    refs: {
      containerRef: { current: null },
      mapRef: { current: { id: "fake-map" } },
    },
  },
}));

vi.mock("mapbox-gl", () => {
  class MockPopup {
    setHTML() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class MockMarker {
    constructor(options = {}) {
      this.el = options.element;
      this.removed = false;
      state.markers.push(this);
    }
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      this.removed = true;
    }
  }
  return {
    default: {
      accessToken: "",
      Map: vi.fn(),
      NavigationControl: vi.fn(),
      Marker: MockMarker,
      Popup: MockPopup,
    },
  };
});

vi.mock("../src/hooks/useMapboxMap", () => ({
  useMapboxMap: () => state.refs,
}));

const INCIDENT_A = {
  id: "INC-A",
  category: "FLOOD",
  status: "PENDING",
  priority: "HIGH",
  location: "Marikina City",
  elapsedMinutes: 2,
  coords: { lat: 14.65, lng: 121.1 },
};
const INCIDENT_B = {
  id: "INC-B",
  category: "FIRE",
  status: "PENDING",
  priority: "MEDIUM",
  location: "Concepcion",
  elapsedMinutes: 5,
  coords: { lat: 14.66, lng: 121.11 },
};
const INCIDENT_C = {
  id: "INC-C",
  category: "MEDICAL",
  status: "PENDING",
  priority: "HIGH",
  location: "Kalumpang",
  elapsedMinutes: 1,
  coords: { lat: 14.67, lng: 121.12 },
};

const PULSE_CLASS = "animate-marker-pulse";

function liveMarkerEls() {
  return state.markers.filter((m) => !m.removed).map((m) => m.el);
}

function markerElFor(id) {
  return liveMarkerEls().find((el) =>
    (el.getAttribute("aria-label") || "").endsWith(`incident ${id}`),
  );
}

function renderMap(props = {}) {
  const utils = render(
    <IncidentMap
      incidents={props.incidents ?? [INCIDENT_A, INCIDENT_B, INCIDENT_C]}
      onSelectIncident={props.onSelectIncident ?? (() => {})}
      activeFilter={props.activeFilter ?? "ALL"}
      newIncidentIds={props.newIncidentIds ?? []}
    />,
  );
  return {
    ...utils,
    rerenderWith(next) {
      utils.rerender(
        <IncidentMap
          incidents={next.incidents ?? [INCIDENT_A, INCIDENT_B, INCIDENT_C]}
          onSelectIncident={next.onSelectIncident ?? (() => {})}
          activeFilter={next.activeFilter ?? "ALL"}
          newIncidentIds={next.newIncidentIds ?? []}
        />,
      );
    },
  };
}

describe("IncidentMap — new-incident marker pulse", () => {
  beforeEach(() => {
    state.markers.length = 0;
  });

  it("leaves existing markers untouched when there are no new incident IDs", () => {
    renderMap({ newIncidentIds: [] });

    const els = liveMarkerEls();
    expect(els).toHaveLength(3);
    els.forEach((el) => {
      expect(el.className).not.toContain(PULSE_CLASS);
    });
    expect(
      els.some((el) => el.getAttribute("aria-label") === "FLOOD incident INC-A"),
    ).toBe(true);
    expect(
      els.some((el) => el.getAttribute("aria-label") === "FIRE incident INC-B"),
    ).toBe(true);
    expect(
      els.some((el) => el.getAttribute("aria-label") === "MEDICAL incident INC-C"),
    ).toBe(true);
  });

  it("pulses only the marker of the newly arrived incident", () => {
    renderMap({ newIncidentIds: ["INC-B"] });

    expect(markerElFor("INC-B").className).toContain(PULSE_CLASS);
    expect(markerElFor("INC-A").className).not.toContain(PULSE_CLASS);
    expect(markerElFor("INC-C").className).not.toContain(PULSE_CLASS);
  });

  it("pulses every corresponding marker when multiple new incidents arrive", () => {
    renderMap({ newIncidentIds: ["INC-A", "INC-C"] });

    expect(markerElFor("INC-A").className).toContain(PULSE_CLASS);
    expect(markerElFor("INC-C").className).toContain(PULSE_CLASS);
    expect(markerElFor("INC-B").className).not.toContain(PULSE_CLASS);
  });

  it("never applies the pulse for a new ID with no matching marker", () => {
    renderMap({ newIncidentIds: ["INC-NOPE"] });

    const els = liveMarkerEls();
    expect(els).toHaveLength(3);
    els.forEach((el) => {
      expect(el.className).not.toContain(PULSE_CLASS);
    });
  });

  it("keeps click-to-select working on an unflagged marker", () => {
    const onSelectIncident = vi.fn();
    renderMap({ newIncidentIds: [], onSelectIncident });

    fireEvent.click(markerElFor("INC-A"));

    expect(onSelectIncident).toHaveBeenCalledTimes(1);
    expect(onSelectIncident.mock.calls[0][0].id).toBe("INC-A");
  });

  it("keeps click-to-select working on a pulsing marker", () => {
    const onSelectIncident = vi.fn();
    renderMap({ newIncidentIds: ["INC-B"], onSelectIncident });

    fireEvent.click(markerElFor("INC-B"));

    expect(onSelectIncident).toHaveBeenCalledTimes(1);
    expect(onSelectIncident.mock.calls[0][0].id).toBe("INC-B");
  });

  it("stops pulsing once the next poll reports no new incidents", () => {
    const { rerenderWith } = renderMap({ newIncidentIds: ["INC-A"] });
    expect(markerElFor("INC-A").className).toContain(PULSE_CLASS);

    rerenderWith({ newIncidentIds: [] });

    liveMarkerEls().forEach((el) => {
      expect(el.className).not.toContain(PULSE_CLASS);
    });
  });

  it("disables the pulse under prefers-reduced-motion like the other animations", () => {
    const css = readFileSync(
      path.resolve(process.cwd(), "src", "index.css"),
      "utf8",
    );
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/,
    )?.[0];

    expect(block).toBeTruthy();
    expect(block).toContain(".animate-marker-pulse");
    expect(block).toContain("animation: none");
  });
});
