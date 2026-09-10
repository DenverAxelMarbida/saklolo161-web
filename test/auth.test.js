import { describe, it, expect, vi, beforeEach } from "vitest";
import { onAuthChange, logout, getStoredAuth } from "../src/lib/auth";

describe("onAuthChange", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fires immediately with the stored auth, mirroring onAuthStateChanged", () => {
    localStorage.setItem("saklolo_token", "jwt-token");
    localStorage.setItem(
      "saklolo_user",
      JSON.stringify({
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "MDRRMO",
        role: "dispatcher",
      }),
    );

    const cb = vi.fn();
    const unsubscribe = onAuthChange(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith({
      token: "jwt-token",
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "MDRRMO",
        role: "dispatcher",
      },
    });

    unsubscribe();
  });

  it("fires immediately with null when nothing is stored", () => {
    const cb = vi.fn();
    onAuthChange(cb);

    expect(cb).toHaveBeenCalledWith(null);
  });

  it("returns an unsubscribe that stops future notifications", () => {
    const cb = vi.fn();
    const unsubscribe = onAuthChange(cb);
    cb.mockClear();

    unsubscribe();
    logout();

    expect(cb).not.toHaveBeenCalled();
  });

  it("keeps notifying other listeners after one unsubscribes", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = onAuthChange(a);
    onAuthChange(b);

    // The immediate fire on subscribe already used one call each.
    a.mockClear();
    b.mockClear();

    unsubscribeA();
    logout();

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenLastCalledWith(null);
  });
});

describe("getStoredAuth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when the token or user is missing", () => {
    expect(getStoredAuth()).toBeNull();
  });

  it("returns null for unparseable stored user JSON", () => {
    localStorage.setItem("saklolo_token", "t");
    localStorage.setItem("saklolo_user", "not-json");

    expect(getStoredAuth()).toBeNull();
  });
});