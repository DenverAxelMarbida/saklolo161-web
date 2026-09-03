import axios from "axios";
import { API_BASE_URL } from "./config";

// ---------------------------------------------------------------------------
// Phase 2 auth module — lightweight localStorage-backed JWT auth.
//
// Phase 3 can swap this file's internals for the Firebase client SDK's
// signInWithEmailAndPassword / onAuthStateChanged (which also handles
// silent hourly ID-token refresh) without changing how App.jsx consumes
// it, as long as onAuthChange keeps firing with the same
//   { token, user: { uid, email, agency, role } } | null
// shape.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "saklolo_token";
const USER_KEY = "saklolo_user";

/** @type {Set<(auth: { token: string, user: object } | null) => void>} */
const listeners = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function notifyListeners(auth) {
  for (const cb of listeners) {
    cb(auth);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads { token, user } from localStorage, or returns null if either
 * key is missing / unparseable. Exported directly for one-off reads
 * (e.g. the axios interceptor in api.js) that don't need the
 * subscription.
 */
export function getStoredAuth() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!token || !userRaw) return null;
    return { token, user: JSON.parse(userRaw) };
  } catch {
    return null;
  }
}

/**
 * POSTs credentials to the backend, stores the returned JWT + user
 * object in localStorage, notifies every subscribed listener, and
 * returns { token, user }.
 */
export async function login(email, password) {
  const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
    email,
    password,
  });

  const { token, user } = response.data.data;

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  const auth = { token, user };
  notifyListeners(auth);

  return auth;
}

/**
 * Clears both localStorage keys and notifies every subscribed listener
 * with null.
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyListeners(null);
}

/**
 * Subscribes `callback` to auth-state changes. Immediately invokes it
 * once with the current getStoredAuth() result so callers never need a
 * separate initial-read step before subscribing. Returns an unsubscribe
 * function that removes the callback from the listener set.
 *
 * Deliberately mirrors Firebase's onAuthStateChanged(callback) shape.
 */
export function onAuthChange(callback) {
  listeners.add(callback);

  // Fire once synchronously with the current value, just like Firebase.
  callback(getStoredAuth());

  return () => {
    listeners.delete(callback);
  };
}
