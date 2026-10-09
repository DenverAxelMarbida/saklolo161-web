import { initializeApp } from "firebase/app";
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// ---------------------------------------------------------------------------
// Phase 3 Firebase Auth module — replaces the Phase 2 localStorage JWT flow.
//
// The public contract is frozen (../saklolo161-phase3-contracts.md and
// ../saklolo161-auth-coordination.md): onAuthChange keeps emitting
//   { token: firebaseIdToken, user: { uid, email, agency, role } } | null
// so App.jsx / Header.jsx / api.js / Login.jsx never change. `agency` and
// `role` come exclusively from Firebase custom claims set at provisioning
// (backend scripts/provisionUser.js) — never defaulted or invented here.
//
// Firebase is the only source of auth state: nothing auth-related is
// persisted to localStorage anymore. A synchronous in-memory cache keeps
// api.js's request interceptor (`getStoredAuth()` in a sync context) working
// while Firebase refreshes ID tokens in the background.
//
// Refresh bootstrap: a minimal { token, user, exp } snapshot (below) lets
// getStoredAuth() recover the last known auth synchronously right after a
// page reload, so the first protected poll carries a Bearer header instead
// of racing the async Firebase session restore into a spurious 401 ->
// logout() -> signOut() chain. The snapshot is short-lived, expiration-
// checked on every read, and always cleared the moment Firebase (the sole
// authority) reports signed out.
// ---------------------------------------------------------------------------

const LEGACY_TOKEN_KEY = "saklolo_token";
const LEGACY_USER_KEY = "saklolo_user";
const SNAPSHOT_KEY = "saklolo_auth_snapshot";

// One-time migration: drop any Phase 2 JWT still sitting in localStorage
// so a stale token can never masquerade as a session.
try {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
} catch {
  // Storage unavailable — nothing to migrate.
}

/** @type {Set<(auth: { token: string, user: { uid: string, email: string|undefined, agency: string, role: string } } | null) => void>} */
const listeners = new Set();

/** One-shot callbacks waiting for Firebase's initial session restore to resolve. */
const restoreListeners = new Set(); // { callback, onError }

/** Synchronous cache consumed by getStoredAuth() and refreshed by the Firebase listener. */
let authCache = null;

let authInstance = null;
let unsubscribeFirebase = null;

// True once Firebase's onIdTokenChanged has delivered its first emission
// (user or null) — i.e. the initial session restore has completed.
let initialEmissionReceived = false;

// ---------------------------------------------------------------------------
// Firebase bootstrap (lazy, once)
// ---------------------------------------------------------------------------

/**
 * Initializes the Firebase client app on first use and memoizes the Auth
 * instance. Lazy so that modules which only touch getStoredAuth() (api.js's
 * interceptor) never force Firebase to boot, and so the app is initialized
 * at most once per page load. No Admin SDK, no hardcoded config — values
 * come from VITE_-prefixed env vars (Vite strips anything unprefixed).
 */
function getFirebaseAuth() {
  if (!authInstance) {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    authInstance = getAuth(app);
  }
  return authInstance;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notifyListeners(auth) {
  for (const cb of listeners) {
    cb(auth);
  }
}

function notifyRestoreListeners() {
  for (const entry of restoreListeners) {
    entry.callback();
  }
  restoreListeners.clear();
}

function clearLegacyStorage() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

function clearSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

function writeSnapshot(authValue, expMs) {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ token: authValue.token, user: authValue.user, exp: expMs }),
    );
  } catch {
    // Storage unavailable — bootstrap degrades to the pre-snapshot behavior.
  }
}

/**
 * Reads the persisted snapshot, enforcing freshness on every read: an
 * expired (or malformed) snapshot is deleted and treated as absent, so a
 * stale token is never handed back to api.js.
 */
function readSnapshot() {
  let raw;
  try {
    raw = localStorage.getItem(SNAPSHOT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw);
    const wellFormed =
      typeof snap?.token === "string" &&
      snap.token.length > 0 &&
      typeof snap?.user?.uid === "string" &&
      snap.user.uid.length > 0 &&
      typeof snap?.user?.agency === "string" &&
      snap.user.agency.length > 0 &&
      typeof snap?.user?.role === "string" &&
      snap.user.role.length > 0 &&
      typeof snap?.exp === "number";
    if (!wellFormed || Date.now() >= snap.exp) {
      clearSnapshot();
      return null;
    }
    return snap;
  } catch {
    clearSnapshot();
    return null;
  }
}

/** Epoch-ms expiration from a getIdTokenResult(), or undefined if absent. */
function expFromTokenResult(tokenResult) {
  const exp = Date.parse(tokenResult?.expirationTime ?? "");
  return Number.isNaN(exp) ? undefined : exp;
}

/**
 * Stores { token, user } (or null) in the synchronous cache, mirrors it
 * into the persisted snapshot (or drops the snapshot on null), and notifies
 * listeners only when the auth value actually changed (same token => no
 * duplicate notifications, e.g. login() and the Firebase listener racing).
 */
function updateAuthCache(next, expMs) {
  const bothNull = authCache === null && next === null;
  const sameToken =
    authCache !== null && next !== null && authCache.token === next.token;
  authCache = next;
  if (next === null) {
    clearSnapshot();
  } else if (typeof expMs === "number") {
    writeSnapshot(next, expMs);
  }
  if (!bothNull && !sameToken) {
    notifyListeners(next);
  }
}

/**
 * Builds the frozen user shape from a Firebase user + custom claims.
 * Missing agency/role throws a Login.jsx-compatible error
 * ({ response: { data: { message } } }) — we never emit an authenticated
 * user without the claims the backend's authorization layer depends on.
 */
function buildUser(firebaseUser, claims) {
  const agency = claims?.agency;
  const role = claims?.role;

  if (!firebaseUser?.uid || !agency || !role) {
    const message =
      "This account is missing required access claims. Ask an administrator to re-provision your account.";
    const err = new Error(message);
    err.code = "auth/missing-claims";
    err.response = { data: { message } };
    throw err;
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    agency,
    role,
  };
}

/**
 * Translates Firebase Auth errors into an axios-shaped error carrying a
 * clear, non-sensitive user-facing message, exactly what Login.jsx reads
 * (`err.response.data.message`). Firebase internals are never exposed.
 */
function toLoginError(err) {
  const messages = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-email": "Invalid email or password.",
    "auth/user-disabled": "This account has been disabled. Contact an administrator.",
    "auth/too-many-requests": "Too many failed attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
  };
  const message = messages[err?.code] || "Sign-in failed. Please try again.";
  const translated = new Error(message);
  translated.code = err?.code || "auth/unknown";
  translated.response = { data: { message } };
  return translated;
}

/**
 * Starts the single Firebase auth-state listener (idempotent — every
 * consumer shares it; never one listener per subscriber).
 *
 * Uses onIdTokenChanged, Firebase's superset of onAuthStateChanged: it
 * fires on initial state resolution, sign-in, sign-out, AND every ID-token
 * refresh — which is what keeps the synchronous cache stocked with a valid
 * token for api.js's interceptor without any polling.
 */
function ensureFirebaseSubscription() {
  if (unsubscribeFirebase) return;

  unsubscribeFirebase = onIdTokenChanged(getFirebaseAuth(), async (firebaseUser) => {
    // First emission = Firebase's initial session restore has resolved.
    const firstEmission = !initialEmissionReceived;
    initialEmissionReceived = true;
    try {
      if (!firebaseUser) {
        // Genuine signed-out state: drop the snapshot so no persisted token
        // can outlive Firebase's authority, then push null to subscribers.
        clearSnapshot();
        updateAuthCache(null);
        return;
      }
      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        const user = await buildUser(firebaseUser, tokenResult.claims);
        updateAuthCache(
          { token: tokenResult.token, user },
          expFromTokenResult(tokenResult),
        );
      } catch {
        // Missing claims or token fetch failure: never emit an invalid
        // authenticated user — treat the session as signed out.
        updateAuthCache(null);
      }
    } finally {
      // Fire ONLY after the auth decision above has been processed and
      // pushed to onAuthChange subscribers. Lifting App's restore gate
      // any earlier (as the pre-review code did) rendered Login for a
      // signed-in user in the window between the gate lifting and the
      // async token/claims resolution landing. The finally also
      // guarantees a restoration error can never leave the gate stuck.
      if (firstEmission) notifyRestoreListeners();
    }
  });
}

// ---------------------------------------------------------------------------
// Public API (frozen contract)
// ---------------------------------------------------------------------------

/**
 * Synchronous read of the current { token, user } (or null). api.js's
 * request interceptor depends on this staying synchronous — it never
 * awaits Firebase. On a fresh page load (empty in-memory cache) it
 * bootstraps from the persisted snapshot when that snapshot is present,
 * well-formed, and unexpired; otherwise it returns null and the expired
 * snapshot is cleared.
 */
export function getStoredAuth() {
  if (!authCache) {
    const snap = readSnapshot();
    if (snap) {
      authCache = { token: snap.token, user: { ...snap.user } };
    }
  }
  if (!authCache) return null;
  return { token: authCache.token, user: { ...authCache.user } };
}

/**
 * Signs in with Firebase email/password, verifies the { agency, role }
 * custom claims on the freshly issued ID token, updates the cache (which
 * notifies subscribers), and returns { token, user }.
 *
 * Rejects with an axios-shaped error for Login.jsx on bad credentials,
 * rate limiting, network failure, or missing claims (in which case the
 * half-signed-in Firebase session is signed back out).
 */
export async function login(email, password) {
  ensureFirebaseSubscription();

  let credential;
  try {
    credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  } catch (err) {
    throw toLoginError(err);
  }

  let nextAuth;
  let nextExp;
  try {
    const tokenResult = await credential.user.getIdTokenResult();
    const user = await buildUser(credential.user, tokenResult.claims);
    nextAuth = { token: tokenResult.token, user };
    nextExp = expFromTokenResult(tokenResult);
  } catch (err) {
    await signOut(getFirebaseAuth()).catch(() => {});
    updateAuthCache(null);
    // buildUser errors are already Login.jsx-compatible; Firebase
    // token-fetch errors still get translated.
    throw err?.response ? err : toLoginError(err);
  }

  updateAuthCache(nextAuth, nextExp);
  return { token: nextAuth.token, user: { ...nextAuth.user } };
}

/**
 * Signs out of Firebase, empties the synchronous cache, drops the
 * persisted snapshot, clears any leftover Phase 2 localStorage keys, and
 * notifies subscribers with null.
 *
 * Restore-window guard: while Firebase's initial restore has not yet
 * delivered its first emission AND there is no authenticated cache state
 * to sign out, the call can only be api.js's premature 401 interceptor
 * reacting to a headerless request that raced the restore — signOut()
 * would destroy the still-restoring session, so it is skipped. Any
 * logout() once Firebase has initialized (or with an authenticated cache,
 * e.g. right after login()) behaves exactly as before.
 */
export function logout() {
  clearLegacyStorage();
  const hadAuthenticatedState = authCache !== null;
  updateAuthCache(null);

  if (unsubscribeFirebase && (initialEmissionReceived || hadAuthenticatedState)) {
    // The shared listener confirms the sign-out; failures here are
    // non-fatal (the cache is already cleared and listeners notified).
    signOut(getFirebaseAuth()).catch(() => {});
  }
}

/**
 * Subscribes `callback` to auth-state changes. Immediately invokes it
 * once with the current cache (mirroring onAuthStateChanged's shape —
 * null on a cold start until Firebase resolves a persisted session),
 * then again on every sign-in, sign-out, and token refresh. Returns an
 * unsubscribe function that removes only this callback.
 */
export function onAuthChange(callback) {
  listeners.add(callback);
  ensureFirebaseSubscription();

  // Fire once synchronously with the current value, just like Firebase.
  callback(getStoredAuth());

  return () => {
    listeners.delete(callback);
  };
}

/**
 * Subscribes to the one-shot "initial session restore completed" signal
 * (additive — onAuthChange's frozen contract is untouched). Invokes
 * `callback` immediately if Firebase's first emission already arrived,
 * otherwise exactly once when it does (signed-in or signed-out alike) —
 * and always AFTER that emission's auth decision has been processed, so
 * a signed-in restore can't race App past its own gate. If Firebase
 * initialization/subscription throws, `onError` is invoked instead of
 * propagating so the caller can surface a recoverable state; the
 * callback stays registered for a late emission if one ever arrives.
 * Returns an unsubscribe function.
 *
 * App.jsx uses this to tell "still restoring" apart from "restored to
 * signed-out", so the login screen no longer flashes while Firebase
 * replays a persisted session.
 */
export function onAuthRestore(callback, onError = () => {}) {
  if (initialEmissionReceived) {
    callback();
    return () => {};
  }
  const entry = { callback, onError };
  restoreListeners.add(entry);
  try {
    ensureFirebaseSubscription();
  } catch (error) {
    onError(error);
  }

  return () => {
    restoreListeners.delete(entry);
  };
}
