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
// ---------------------------------------------------------------------------

const LEGACY_TOKEN_KEY = "saklolo_token";
const LEGACY_USER_KEY = "saklolo_user";

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

/** Synchronous cache consumed by getStoredAuth() and refreshed by the Firebase listener. */
let authCache = null;

let authInstance = null;
let unsubscribeFirebase = null;

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

function clearLegacyStorage() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/**
 * Stores { token, user } (or null) in the synchronous cache and notifies
 * listeners only when the auth value actually changed (same token => no
 * duplicate notifications, e.g. login() and the Firebase listener racing).
 */
function updateAuthCache(next) {
  const bothNull = authCache === null && next === null;
  const sameToken =
    authCache !== null && next !== null && authCache.token === next.token;
  authCache = next;
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
    if (!firebaseUser) {
      updateAuthCache(null);
      return;
    }
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      const user = await buildUser(firebaseUser, tokenResult.claims);
      updateAuthCache({ token: tokenResult.token, user });
    } catch {
      // Missing claims or token fetch failure: never emit an invalid
      // authenticated user — treat the session as signed out.
      updateAuthCache(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Public API (frozen contract)
// ---------------------------------------------------------------------------

/**
 * Synchronous read of the current { token, user } (or null) from the
 * in-memory cache. api.js's request interceptor depends on this staying
 * synchronous — it never awaits Firebase.
 */
export function getStoredAuth() {
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
  try {
    const tokenResult = await credential.user.getIdTokenResult();
    const user = await buildUser(credential.user, tokenResult.claims);
    nextAuth = { token: tokenResult.token, user };
  } catch (err) {
    await signOut(getFirebaseAuth()).catch(() => {});
    updateAuthCache(null);
    // buildUser errors are already Login.jsx-compatible; Firebase
    // token-fetch errors still get translated.
    throw err?.response ? err : toLoginError(err);
  }

  updateAuthCache(nextAuth);
  return { token: nextAuth.token, user: { ...nextAuth.user } };
}

/**
 * Signs out of Firebase, empties the synchronous cache, clears any
 * leftover Phase 2 localStorage keys, and notifies subscribers with null.
 */
export function logout() {
  clearLegacyStorage();
  updateAuthCache(null);

  if (unsubscribeFirebase) {
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
