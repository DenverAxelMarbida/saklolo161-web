import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Firebase client SDK is mocked so the suite runs offline and never touches
// a real Firebase project. auth.js is re-imported fresh per test so its
// module-level cache / listener set / subscription state reset each time.
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => {
  const s = {
    signInImpl: null,
    signOut: vi.fn(async () => {
      s.signedOut = true;
    }),
    signedOut: false,
    subscribeCalls: 0,
    firebaseListeners: new Set(),
    reset() {
      this.signInImpl = null;
      this.signedOut = false;
      this.subscribeCalls = 0;
      this.firebaseListeners.clear();
      this.signOut.mockClear();
    },
  };
  return s;
});

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "web-mock-app" })),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: (...args) => state.signInImpl(...args),
  signOut: (...args) => state.signOut(...args),
  onIdTokenChanged: vi.fn((_auth, callback) => {
    state.subscribeCalls += 1;
    state.firebaseListeners.add(callback);
    return () => state.firebaseListeners.delete(callback);
  }),
}));

function makeFirebaseUser({
  uid = "u1",
  email = "officer@marikina.gov",
  token = "id-token-1",
  claims = { agency: "FLOOD", role: "dispatcher" },
} = {}) {
  return {
    uid,
    email,
    getIdTokenResult: vi.fn(async () => ({ token, claims })),
  };
}

function lastFirebaseListener() {
  const listeners = [...state.firebaseListeners];
  return listeners[listeners.length - 1];
}

let auth;

beforeEach(async () => {
  vi.resetModules();
  state.reset();
  state.signInImpl = async () => ({ user: makeFirebaseUser() });
  localStorage.clear();
  auth = await import("../src/lib/auth");
});

describe("login", () => {
  it("returns {token, user} with agency/role from custom claims and notifies subscribers", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    expect(cb).toHaveBeenLastCalledWith(null); // immediate cold-start fire

    const result = await auth.login("flood@marikina.gov.ph", "changeme123");

    expect(result).toEqual({
      token: "id-token-1",
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "FLOOD",
        role: "dispatcher",
      },
    });
    expect(Object.keys(result.user).sort()).toEqual([
      "agency",
      "email",
      "role",
      "uid",
    ]);
    expect(cb).toHaveBeenLastCalledWith(result);
    expect(auth.getStoredAuth()).toEqual(result);

    // Firebase session only — no auth material written to localStorage.
    expect(localStorage.getItem("saklolo_token")).toBeNull();
    expect(localStorage.getItem("saklolo_user")).toBeNull();

    unsubscribe();
  });

  it("translates invalid credentials into a Login.jsx-compatible error", async () => {
    state.signInImpl = async () => {
      const err = new Error("Firebase: ...");
      err.code = "auth/invalid-credential";
      throw err;
    };

    await expect(auth.login("x@y.z", "nope")).rejects.toMatchObject({
      code: "auth/invalid-credential",
      response: { data: { message: "Invalid email or password." } },
    });
    expect(auth.getStoredAuth()).toBeNull();
  });

  it("translates network failures into the connection message Login.jsx expects", async () => {
    state.signInImpl = async () => {
      const err = new Error("failed to fetch");
      err.code = "auth/network-request-failed";
      throw err;
    };

    await expect(auth.login("x@y.z", "pw")).rejects.toMatchObject({
      response: {
        data: {
          message: "Couldn't reach the server. Check your connection and try again.",
        },
      },
    });
  });

  it("rejects clearly when agency/role claims are missing and signs back out", async () => {
    state.signInImpl = async () => ({
      user: makeFirebaseUser({ claims: { agency: "FLOOD" } }), // no role
    });

    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);

    await expect(auth.login("x@y.z", "pw")).rejects.toMatchObject({
      code: "auth/missing-claims",
      response: {
        data: {
          message: expect.stringContaining("missing required access claims"),
        },
      },
    });

    expect(state.signedOut).toBe(true); // half-signed-in session rolled back
    expect(auth.getStoredAuth()).toBeNull();
    // Listeners only ever saw null — never an invalid authenticated user.
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null);

    unsubscribe();
  });
});

describe("onAuthChange", () => {
  it("fires immediately with null on a cold start", () => {
    const cb = vi.fn();
    auth.onAuthChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null);
  });

  it("fires immediately with the cached auth for a late subscriber", async () => {
    await auth.login("flood@marikina.gov.ph", "changeme123");

    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      token: "id-token-1",
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "FLOOD",
        role: "dispatcher",
      },
    });
    unsubscribe();
  });

  it("returns an unsubscribe that stops future notifications", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    cb.mockClear();

    unsubscribe();
    await auth.logout();

    expect(cb).not.toHaveBeenCalled();
  });

  it("keeps notifying other listeners after one unsubscribes", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = auth.onAuthChange(a);
    auth.onAuthChange(b);

    a.mockClear();
    b.mockClear();

    unsubscribeA();
    await auth.login("flood@marikina.gov.ph", "changeme123");

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeA(); // idempotent; b stays subscribed (teardown coverage)
    unsubscribeA();
  });

  it("shares a single Firebase subscription across all consumers", () => {
    auth.onAuthChange(vi.fn());
    auth.onAuthChange(vi.fn());
    expect(state.subscribeCalls).toBe(1);
  });
});

describe("logout", () => {
  it("signs out of Firebase, clears the cache, and notifies null", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    await auth.login("flood@marikina.gov.ph", "changeme123");
    expect(auth.getStoredAuth()).not.toBeNull();

    auth.logout();

    expect(auth.getStoredAuth()).toBeNull();
    expect(cb).toHaveBeenLastCalledWith(null);
    expect(state.signOut).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("clears legacy Phase 2 localStorage keys left behind by the old flow", async () => {
    localStorage.setItem("saklolo_token", "legacy-jwt");
    localStorage.setItem("saklolo_user", JSON.stringify({ uid: "old" }));

    vi.resetModules();
    await import("../src/lib/auth");

    expect(localStorage.getItem("saklolo_token")).toBeNull();
    expect(localStorage.getItem("saklolo_user")).toBeNull();
  });
});

describe("getStoredAuth", () => {
  it("reads the cache synchronously without awaiting Firebase", () => {
    expect(auth.getStoredAuth()).toBeNull();
  });

  it("returns the cached {token, user} after login and null after logout", async () => {
    const result = await auth.login("flood@marikina.gov.ph", "changeme123");

    expect(auth.getStoredAuth()).toEqual(result);
    auth.logout();
    expect(auth.getStoredAuth()).toBeNull();
  });
});

describe("Firebase token refresh and state changes", () => {
  it("updates the cache and notifies with a fresh token on refresh", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    await auth.login("flood@marikina.gov.ph", "changeme123");
    expect(auth.getStoredAuth().token).toBe("id-token-1");

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(makeFirebaseUser({ token: "id-token-2" }));

    expect(auth.getStoredAuth()).toEqual({
      token: "id-token-2",
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "FLOOD",
        role: "dispatcher",
      },
    });
    expect(cb).toHaveBeenLastCalledWith(
      expect.objectContaining({ token: "id-token-2" }),
    );

    unsubscribe();
  });

  it("does not re-notify when the same token fires again", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    await auth.login("flood@marikina.gov.ph", "changeme123");

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(makeFirebaseUser({ token: "id-token-1" }));
    const callsAfterLogin = cb.mock.calls.length;

    await firebaseCallback(makeFirebaseUser({ token: "id-token-1" }));
    expect(cb).toHaveBeenCalledTimes(callsAfterLogin);

    unsubscribe();
  });

  it("emits null (never an invalid user) when claims disappear on refresh", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    await auth.login("flood@marikina.gov.ph", "changeme123");

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(
      makeFirebaseUser({ token: "id-token-2", claims: { agency: "FLOOD" } }),
    );

    expect(auth.getStoredAuth()).toBeNull();
    expect(cb).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });

  it("emits null when Firebase reports signed-out state", async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    await auth.login("flood@marikina.gov.ph", "changeme123");

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(null);

    expect(auth.getStoredAuth()).toBeNull();
    expect(cb).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });
});
