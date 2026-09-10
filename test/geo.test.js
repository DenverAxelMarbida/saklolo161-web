import { describe, it, expect } from "vitest";
import { haversineMeters, straightLineEstimate } from "../src/lib/geo";

describe("geo helpers", () => {
  it("computes haversine distance", () => {
    // Marikina → ~1° north ≈ 111 km.
    const meters = haversineMeters(14.65, 121.1, 15.65, 121.1);
    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });

  it("returns the expected distance/ETA shape", () => {
    const est = straightLineEstimate(14.65, 121.1, 14.75, 121.1);
    expect(est.distanceMeters).toBeGreaterThan(10000);
    // 11.1 km at 40 km/h ≈ 1000 s.
    expect(est.durationSeconds).toBeGreaterThan(900);
    expect(est.durationSeconds).toBeLessThan(1100);
  });

  it("handles identical points (no movement)", () => {
    expect(straightLineEstimate(14.65, 121.1, 14.65, 121.1)).toEqual({
      distanceMeters: 0,
      durationSeconds: 0,
    });
  });
});