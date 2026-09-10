import { describe, it, expect, vi, beforeEach } from "vitest";

// auth.js imports axios for login() — not exercised in these tests, but
// the module import must succeed so onAuthChange can be tested in
// isolation.
vi.mock("axios", () => ({
  default: { create: vi.fn(), post: vi.fn() },
}));

import { onAuthChange, logout } from "./auth";

const TOKEN_KEY = "saklolo_token";
const USER_KEY = "saklolo_user";

beforeEach(() => {
  localStorage.clear();
});

describe("onAuthChange", () => {
  it("fires immediately with the currently stored auth", () => {
    localStorage.setItem(TOKEN_KEY, "tok-123");
    localStorage.setItem(USER_KEY, JSON.stringify({ uid: "u1", email: "d@rescue.gov", agency: "FIRE", role: "dispatcher" }));

    const cb = vi.fn();
    const unsubscribe = onAuthChange(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      token: "tok-123",
      user: { uid: "u1", email: "d@rescue.gov", agency: "FIRE", role: "dispatcher" },
    });
    unsubscribe();
  });

  it("fires immediately with null when signed out", () => {
    const cb = vi.fn();
    onAuthChange(cb);

    expect(cb).toHaveBeenCalledWith(null);
  });

  it("returns an unsubscribe function that stops future notifications", () => {
    const cb = vi.fn();
    const unsubscribe = onAuthChange(cb); // 1 call (immediate fire)
    expect(typeof unsubscribe).toBe("function");

    unsubscribe();
    logout(); // would notify every subscribed listener if still attached
    expect(cb).toHaveBeenCalledTimes(1);
  });
});