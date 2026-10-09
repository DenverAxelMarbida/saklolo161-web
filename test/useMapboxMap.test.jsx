import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useMapboxMap } from "../src/hooks/useMapboxMap";

const { mapState } = vi.hoisted(() => ({ mapState: { instances: [] } }));

vi.mock("mapbox-gl", () => {
  class MockMap {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.removed = false;
      mapState.instances.push(this);
    }
    addControl() {}
    on(event, cb) {
      (this.handlers[event] ||= []).push({ cb, once: false });
      return this;
    }
    once(event, cb) {
      (this.handlers[event] ||= []).push({ cb, once: true });
      return this;
    }
    off(event, cb) {
      this.handlers[event] = (this.handlers[event] || []).filter((h) => h.cb !== cb);
      return this;
    }
    remove() {
      this.removed = true;
    }
    emit(event, payload) {
      const list = this.handlers[event] || [];
      this.handlers[event] = list.filter((h) => !h.once);
      list.forEach((h) => h.cb(payload));
    }
  }
  return {
    default: {
      accessToken: "",
      Map: MockMap,
      NavigationControl: class MockNavigationControl {},
    },
  };
});

function Probe() {
  const { containerRef, loaded, loadFailed } = useMapboxMap();
  return (
    <div
      ref={containerRef}
      data-testid="probe"
      data-loaded={String(loaded)}
      data-failed={String(loadFailed)}
    />
  );
}

function probeAttrs(getByTestId) {
  const el = getByTestId("probe");
  return { loaded: el.dataset.loaded, failed: el.dataset.failed };
}

describe("useMapboxMap", () => {
  beforeEach(() => {
    mapState.instances.length = 0;
  });

  it("stays un-loaded until the style's load event fires", () => {
    const { getByTestId } = render(<Probe />);
    expect(mapState.instances.length).toBe(1);
    expect(probeAttrs(getByTestId)).toEqual({ loaded: "false", failed: "false" });

    act(() => mapState.instances[0].emit("load"));

    expect(probeAttrs(getByTestId)).toEqual({ loaded: "true", failed: "false" });
  });

  it("flags an error raised before the style loads as fatal", () => {
    const { getByTestId } = render(<Probe />);

    act(() => mapState.instances[0].emit("error", { error: new Error("style failed") }));

    expect(probeAttrs(getByTestId)).toEqual({ loaded: "false", failed: "true" });
  });

  it("ignores tile errors after the style has loaded", () => {
    const { getByTestId } = render(<Probe />);
    const map = mapState.instances[0];

    act(() => map.emit("load"));
    act(() => map.emit("error", { error: new Error("tile request failed") }));

    expect(probeAttrs(getByTestId)).toEqual({ loaded: "true", failed: "false" });
  });

  it("clears the failure when the style eventually loads", () => {
    const { getByTestId } = render(<Probe />);
    const map = mapState.instances[0];

    act(() => map.emit("error", { error: new Error("transient") }));
    expect(probeAttrs(getByTestId)).toEqual({ loaded: "false", failed: "true" });

    act(() => map.emit("load"));
    expect(probeAttrs(getByTestId)).toEqual({ loaded: "true", failed: "false" });
  });

  it("tears the map down on unmount", () => {
    const { unmount } = render(<Probe />);
    const map = mapState.instances[0];

    unmount();

    expect(map.removed).toBe(true);
  });
});
