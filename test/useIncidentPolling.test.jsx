import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the API layer so the hook's interval can never reach a real
// backend (or the network) from the suite. mockIncidents is left real
// so the error-fallback path exercises the actual fallback data.
const { getIncidentsMock } = vi.hoisted(() => ({ getIncidentsMock: vi.fn() }));
vi.mock("../src/lib/api", () => ({ getIncidents: getIncidentsMock }));

import { useIncidentPolling } from "../src/hooks/useIncidentPolling";

const inc = (id) => ({ id, category: "FLOOD", status: "PENDING" });

const A = inc("INC-A");
const B = inc("INC-B");
const C = inc("INC-C");

async function mountWithFirstFetch(firstFetch) {
  getIncidentsMock.mockResolvedValueOnce(firstFetch);
  const utils = renderHook(() => useIncidentPolling());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
}

async function refetch(result, next) {
  getIncidentsMock.mockResolvedValueOnce(next);
  await act(async () => {
    await result.current.refresh();
  });
}

afterEach(() => {
  vi.clearAllMocks();
  // Drop any unconsumed one-shot queue entries so a test that failed
  // mid-way can't leak a stale resolution into the next test.
  getIncidentsMock.mockReset();
});

describe("useIncidentPolling — new-incident detection", () => {
  it("seeds the first successful fetch without producing new IDs (no backlog notify)", async () => {
    const { result } = await mountWithFirstFetch([A, B]);

    expect(result.current.incidents.map((i) => i.id)).toEqual(["INC-A", "INC-B"]);
    expect(result.current.newIncidentIds).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("flags ONLY the newly appeared ID on a later fetch", async () => {
    const { result } = await mountWithFirstFetch([A, B]);

    await refetch(result, [A, B, C]);

    expect(result.current.newIncidentIds).toEqual(["INC-C"]);
  });

  it("produces none on the next identical fetch (no repeat on every poll)", async () => {
    const { result } = await mountWithFirstFetch([A, B]);
    await refetch(result, [A, B, C]);
    expect(result.current.newIncidentIds).toEqual(["INC-C"]);

    await refetch(result, [A, B, C]);

    expect(result.current.newIncidentIds).toEqual([]);
  });

  it("produces none when refresh() re-fetches the same data", async () => {
    const { result } = await mountWithFirstFetch([A, B]);
    await refetch(result, [A, B, C]);

    await refetch(result, [A, B, C]);
    await refetch(result, [A, B, C]);

    expect(result.current.newIncidentIds).toEqual([]);
  });

  it("never treats an incident that disappears and returns as new again", async () => {
    const { result } = await mountWithFirstFetch([A, B]);

    await refetch(result, [B]); // A disappears
    expect(result.current.newIncidentIds).toEqual([]);

    await refetch(result, [A, B]); // A returns
    expect(result.current.newIncidentIds).toEqual([]);
  });

  it("produces zero new IDs when the fetch fails and mock fallback kicks in", async () => {
    getIncidentsMock.mockRejectedValueOnce(new Error("backend down"));
    const { result } = renderHook(() => useIncidentPolling());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.incidents.length).toBeGreaterThan(0); // mock fallback data
    expect(result.current.newIncidentIds).toEqual([]);
  });

  it("keeps error behavior: fallback shows mock data, then a real fetch seeds without notify", async () => {
    getIncidentsMock.mockRejectedValueOnce(new Error("cold start"));
    const { result } = renderHook(() => useIncidentPolling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();

    // Backend comes back with the real backlog — still no notifications.
    await refetch(result, [A, B]);
    expect(result.current.newIncidentIds).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.incidents.map((i) => i.id)).toEqual(["INC-A", "INC-B"]);
  });
});
