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
    getIdTokenResult: vi.fn(async () => ({
      token,
      claims,
      expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })),
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

describe("onAuthRestore", () => {
  it("defers the callback until Firebase's first emission arrives", () => {
    auth.onAuthChange(vi.fn()); // starts the shared subscription
    const cb = vi.fn();
    auth.onAuthRestore(cb);

    expect(cb).not.toHaveBeenCalled();
  });

  it("fires pending callbacks when the first emission arrives, even a null one", async () => {
    auth.onAuthChange(vi.fn());
    const cb = vi.fn();
    auth.onAuthRestore(cb);

    await lastFirebaseListener()(null); // signed-out restore completes

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires immediately for a subscriber once the restore already completed", async () => {
    auth.onAuthChange(vi.fn());
    await lastFirebaseListener()(null); // restore done before subscribing

    const cb = vi.fn();
    auth.onAuthRestore(cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires immediately when the restore resolved to an authenticated session", async () => {
    auth.onAuthChange(vi.fn());
    await lastFirebaseListener()(makeFirebaseUser());

    const cb = vi.fn();
    auth.onAuthRestore(cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe before the first emission prevents the callback", async () => {
    auth.onAuthChange(vi.fn());
    const cb = vi.fn();
    const unsubscribe = auth.onAuthRestore(cb);
    unsubscribe();

    await lastFirebaseListener()(null);

    expect(cb).not.toHaveBeenCalled();
  });

  it("signed-in: fires only AFTER subscribers see the authenticated state (no Login flash)", async () => {
    const order = [];
    auth.onAuthRestore(() => {
      order.push({
        listener: "restore",
        session: auth.getStoredAuth() ? "signed-in" : "signed-out",
      });
    });
    // Start the shared subscription and record when the frozen
    // onAuthChange contract pushes the resolved session.
    auth.onAuthChange((a) => {
      if (a) order.push({ listener: "auth", session: "signed-in" });
    });

    await lastFirebaseListener()(makeFirebaseUser());

    // The restore signal must never lift App's gate before the auth
    // listener has been handed the resolved session.
    expect(order[order.length - 1]).toEqual({
      listener: "restore",
      session: "signed-in",
    });
    expect(order.some((e) => e.listener === "auth")).toBe(true);
    expect(order.findIndex((e) => e.listener === "restore")).toBeGreaterThan(
      order.findIndex((e) => e.listener === "auth")
    );
  });

  it("signed-out: fires only AFTER subscribers see null", async () => {
    // Seed a live snapshot so the cold-start fire and the signed-out
    // decision are both observable through onAuthChange.
    localStorage.setItem(
      "saklolo_auth_snapshot",
      JSON.stringify({
        token: "snap-token",
        user: { uid: "u9", email: "x@marikina.gov", agency: "FLOOD", role: "dispatcher" },
        exp: Date.now() + 60_000,
      }),
    );
    const order = [];
    auth.onAuthChange((a) =>
      order.push({ listener: "auth", session: a ? "signed-in" : "signed-out" })
    );
    auth.onAuthRestore(() =>
      order.push({
        listener: "restore",
        session: auth.getStoredAuth() ? "signed-in" : "signed-out",
      })
    );
    order.length = 0; // drop the synchronous cold-start fire

    await lastFirebaseListener()(null);

    // Subscribers must see the signed-out decision before the restore
    // signal lifts App's gate — and the snapshot must already be gone.
    expect(order).toEqual([
      { listener: "auth", session: "signed-out" },
      { listener: "restore", session: "signed-out" },
    ]);
  });

  it("routes an initialization failure to onError instead of throwing", async () => {
    const fbAuth = await import("firebase/auth");
    fbAuth.onIdTokenChanged.mockImplementationOnce(() => {
      throw new Error("init boom");
    });
    const cb = vi.fn();
    const onError = vi.fn();

    let threw = false;
    let unsubscribe;
    try {
      unsubscribe = auth.onAuthRestore(cb, onError);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("init boom");
    expect(cb).not.toHaveBeenCalled();
    unsubscribe?.();
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

// ---------------------------------------------------------------------------
// Refresh-session race fix: persisted snapshot bootstrap + restore-window
// logout guard (see src/lib/auth.js).
// ---------------------------------------------------------------------------

const SNAPSHOT_KEY = "saklolo_auth_snapshot";

function seedSnapshot({
  token = "snap-token",
  exp = Date.now() + 60_000,
} = {}) {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({
      token,
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "FLOOD",
        role: "dispatcher",
      },
      exp,
    }),
  );
}

describe("persisted snapshot bootstrap (refresh race fix)", () => {
  it("D: hydrates getStoredAuth() synchronously from a valid snapshot after refresh", () => {
    seedSnapshot();
    expect(auth.getStoredAuth()).toEqual({
      token: "snap-token",
      user: {
        uid: "u1",
        email: "officer@marikina.gov",
        agency: "FLOOD",
        role: "dispatcher",
      },
    });
  });

  it("D2: onAuthChange's immediate fire carries the snapshot (no login flash)", () => {
    seedSnapshot();
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ token: "snap-token" }),
    );
    unsubscribe();
  });

  it("E: rejects an expired snapshot — returns null and clears it", () => {
    seedSnapshot({ exp: Date.now() - 1_000 });
    expect(auth.getStoredAuth()).toBeNull();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it("persists a snapshot on successful login with a future expiration", async () => {
    await auth.login("flood@marikina.gov.ph", "changeme123");
    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    expect(snap.token).toBe("id-token-1");
    expect(snap.user).toMatchObject({
      uid: "u1",
      agency: "FLOOD",
      role: "dispatcher",
    });
    expect(snap.exp).toBeGreaterThan(Date.now());
  });

  it("F: the first Firebase auth emission replaces the persisted snapshot", async () => {
    seedSnapshot({ token: "snap-token" });
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    expect(auth.getStoredAuth().token).toBe("snap-token");

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(makeFirebaseUser({ token: "id-token-9" }));

    expect(cb).toHaveBeenLastCalledWith(
      expect.objectContaining({ token: "id-token-9" }),
    );
    expect(auth.getStoredAuth().token).toBe("id-token-9");
    expect(JSON.parse(localStorage.getItem(SNAPSHOT_KEY)).token).toBe(
      "id-token-9",
    );
    unsubscribe();
  });

  it("refresh: an ID-token rotation updates the persisted snapshot too", async () => {
    await auth.login("flood@marikina.gov.ph", "changeme123");
    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(makeFirebaseUser({ token: "id-token-2" }));
    expect(JSON.parse(localStorage.getItem(SNAPSHOT_KEY)).token).toBe(
      "id-token-2",
    );
  });

  it("G: genuine Firebase null clears the snapshot and notifies null", async () => {
    seedSnapshot();
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    expect(auth.getStoredAuth()).not.toBeNull();

    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(null);

    expect(cb).toHaveBeenLastCalledWith(null);
    expect(auth.getStoredAuth()).toBeNull();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
    unsubscribe();
  });

  it("H: premature logout during the restore window skips signOut; logout after init still signs out", async () => {
    // No snapshot + no login + no Firebase emission yet = restore window.
    const cb = vi.fn();
    const unsubscribe = auth.onAuthChange(cb);
    auth.logout(); // stands in for api.js's premature 401 interceptor
    expect(state.signOut).not.toHaveBeenCalled();
    expect(auth.getStoredAuth()).toBeNull();

    // Firebase finishes restoring — the session survived the premature call.
    const firebaseCallback = lastFirebaseListener();
    await firebaseCallback(makeFirebaseUser());
    expect(auth.getStoredAuth()).not.toBeNull();

    // Normal logout once initialized signs out exactly as before.
    auth.logout();
    expect(state.signOut).toHaveBeenCalledTimes(1);
    expect(auth.getStoredAuth()).toBeNull();
    expect(cb).toHaveBeenLastCalledWith(null);
    unsubscribe();
  });
});
