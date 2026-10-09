import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Login from "./components/Login";
import ControlRoom from "./components/ControlRoom";
import Settings from "./components/Settings";
import TriageModal from "./components/TriageModal";
import DispatchTracker from "./components/DispatchTracker";
import NewIncidentToast from "./components/NewIncidentToast";
import { useIncidentPolling } from "./hooks/useIncidentPolling";
import { onAuthChange, onAuthRestore, logout } from "./lib/auth";

// The 3 screens map onto one small state machine:
//   selectedIncident === null            -> Screen 1 only
//   selectedIncident.status !== DISPATCHED -> Screen 1 + Triage modal (Screen 2)
//   selectedIncident.status === DISPATCHED -> Screen 1 + Tracker modal (Screen 3)
// Modeling it this way (one selected incident + its own status) means
// there's no separate "which screen" flag that could ever fall out of
// sync with the incident it's describing.
// Bounded wait for Firebase's initial session restore before App shows
// its recoverable failure state. Purely a UI-availability bound: it can
// never mark anyone authenticated (authState still comes only from
// onAuthChange), and a late emission overrides the failed state.
const RESTORE_TIMEOUT_MS = 10_000;

export default function App() {
  const [authState, setAuthState] = useState(null);
  // Firebase's initial session restore: pending → ready (first emission,
  // AFTER its auth decision — see auth.js) or failed (initialization
  // error or the bounded timeout below). "failed" is only a recoverable
  // UI state — it never authenticates anyone (authState still comes
  // exclusively from onAuthChange) — and a late emission always wins
  // over "failed", so a slow restore can't strand the operator. The
  // window where "no auth yet" means "still restoring", NOT "signed
  // out", so Login doesn't flash on every reload of a signed-in session.
  const [restore, setRestore] = useState({ status: "pending", attempt: 0 });
  const retryRestore = useCallback(
    () => setRestore((r) => ({ status: "pending", attempt: r.attempt + 1 })),
    [],
  );
  // `loading` is the hook's FIRST-fetch flag (it never flips back to
  // true — refresh()/the 10s tick don't re-arm it), which is exactly
  // what the queue needs to distinguish "still loading" from "loaded,
  // and there's genuinely nothing here".
  const { incidents, loading, error, refresh, newIncidentIds } =
    useIncidentPolling();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [newIncidentToast, setNewIncidentToast] = useState(null);
  // Three view labels: the Control Room (default), the all-roles
  // Settings page, and "users" — a compatibility entry that lands on
  // Settings' admin-only User Management tab (no separate top-level
  // view anymore). No router — same single-screen state-switch pattern
  // as ControlRoom's queueView.
  const [view, setView] = useState("control");

  // Session-wide record of already-announced IDs, so a batch can never
  // toast the same incident twice (even across filter switches or
  // remounts of the queue). A ref: never triggers a render by itself.
  const toastedIdsRef = useRef(new Set());

  // ControlRoom calls this with the new incidents that are actually
  // visible under the dispatcher's current filter. Keeps the newest
  // batch on screen (replacing any still-visible older one).
  const handleVisibleNewIncidents = useCallback((visible) => {
    const fresh = visible.filter(
      (incident) => !toastedIdsRef.current.has(incident.id),
    );
    if (fresh.length === 0) return;
    for (const incident of fresh) toastedIdsRef.current.add(incident.id);
    setNewIncidentToast({
      id: fresh[0].id,
      category: fresh[0].category,
      count: fresh.length,
    });
  }, []);

  // Subscribe to auth-state changes once on mount. onAuthChange fires
  // the callback immediately with whatever's in localStorage, so
  // there's no separate initial-read step needed.
  useEffect(() => {
    const unsubscribe = onAuthChange((auth) => setAuthState(auth));
    return unsubscribe;
  }, []);

  // One-shot restore signal: onAuthRestore fires immediately when the
  // first emission already arrived, else exactly once when it does —
  // always after the auth decision (auth.js), never before. The bounded
  // timeout converts "never resolved" (Firebase init failed silently,
  // no emission) into the recoverable state below instead of an
  // infinite gate; cleanup cancels both the timer and the subscription
  // on unmount or on a Retry re-attempt.
  useEffect(() => {
    const finish = (status) => {
      // "ready" always wins — even after the timeout fired — so a late
      // Firebase event recovers the UI without any user action, and a
      // session that resolved after an init error can't be masked.
      setRestore((r) =>
        r.status === "ready" ? r : { ...r, status },
      );
    };
    const unsubscribe = onAuthRestore(
      () => finish("ready"),
      () => finish("failed"),
    );
    const timer = setTimeout(() => finish("failed"), RESTORE_TIMEOUT_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [restore.attempt]);

  // Auth state is authoritative: the moment it goes null (logout, or a
  // 401-driven sign-out) drop any view/modal/toast the previous operator
  // left behind, so the next sign-in always lands on a clean Control Room
  // instead of someone else's screen. No-op on the cold-start null.
  useEffect(() => {
    if (authState) return;
    setView("control");
    setSelectedIncident(null);
    setNewIncidentToast(null);
  }, [authState]);

  const handleDispatched = (updatedIncident) => {
    setSelectedIncident(updatedIncident);
    refresh(); // pull the authoritative state immediately rather than waiting up to 10s
  };

  const handleResolved = () => {
    setSelectedIncident(null);
    refresh();
  };

  const handleStatusUpdated = (incidentId, status) => {
    // Update the locally-selected incident's status so the open tracker
    // reflects the dispatcher's own action immediately, then refresh()
    // to pull the authoritative server state rather than waiting up to
    // 10s for the next poll.
    setSelectedIncident((prev) =>
      prev && prev.id === incidentId ? { ...prev, status } : prev,
    );
    refresh();
  };

  // While a modal/tracker is open, keep `selectedIncident` pointed at the
  // freshest polled copy of that incident. The backend attaches
  // `station.coords`, `evidence`, and status changes AFTER dispatch; if we
  // froze the local snapshot the tracker would never learn about them (a
  // dispatched incident would sit on "—" for Distance/ETA until the card was
  // closed and re-opened). This syncs those fields in on every poll tick.
  useEffect(() => {
    if (!selectedIncident) return;
    const fresh = incidents.find((i) => i.id === selectedIncident.id);
    if (fresh) setSelectedIncident(fresh);
  }, [incidents, selectedIncident]);

  // Until Firebase resolves the restore, a null authState is ambiguous:
  // it could be a signed-out user OR a session still being replayed.
  // Show an honest gate instead of flashing the Login screen at every
  // reload of a signed-in dispatcher.
  if (!authState && restore.status === "pending") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p role="status" className="text-sm text-ink-dim">
          Restoring session…
        </p>
      </div>
    );
  }

  // Restore never resolved (init failure or bounded timeout). Show a
  // recoverable error — NOT Login-as-success and never authenticated
  // content; authState is still the only key to the app.
  if (!authState && restore.status === "failed") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <p role="alert" className="text-sm font-semibold text-ink">
          Couldn&apos;t restore your session.
        </p>
        <p className="text-xs text-ink-dim">
          Check your connection, then try again. Nothing was signed in.
        </p>
        <button
          type="button"
          onClick={retryRestore}
          className="rounded-md border border-border bg-panel px-4 py-1.5 text-sm text-ink transition-colors hover:border-ink-dim"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!authState) {
    return <Login onSuccess={() => {}} />;
  }

  const handleLogout = () => {
    // Reached only after the Header's confirmation dialog is accepted —
    // logout() clears the auth cache/snapshot and notifies the
    // onAuthChange subscription, which sets authState back to null and
    // re-renders Login. Nothing else needed here.
    logout();
  };

  const handleNavigate = (nextView) => {
    // Switching views shouldn't leave a triage/tracker modal hanging
    // over the newly selected screen.
    setSelectedIncident(null);
    setView(nextView);
  };

  // Defense in depth: the Header offers no User Management entry at all —
  // admins reach it through Settings' tab, and the legacy "users" view
  // label also refuses to render for anyone but an admin (plus the
  // backend 403s every /api/users call regardless — that's the real
  // boundary). Settings is open to both roles; only its User Management
  // tab is admin-gated.
  const usersEntry = view === "users" && authState.user.role === "admin";
  const showSettings = view === "settings" || usersEntry;

  // Once an incident reaches "Dispatched" it moves into the live-tracker
  // flow and stays there through "En Route" until "Resolved". Selecting a
  // modal by `status === "DISPATCHED"` exactly would bounce it back to the
  // Triage popup the moment "Mark En Route" advanced the status to
  // "EN ROUTE" — so branch on "at or past Dispatched" instead.
  const isDispatchedFlow =
    selectedIncident != null &&
    ["DISPATCHED", "EN ROUTE"].includes(
      (selectedIncident.status || "").toUpperCase(),
    );

  return (
    <div className="flex h-screen animate-screen-in flex-col">
      <Header
        dutyOfficer={authState.user.email}
        view={view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {/* key={view} only remounts this stateless layout shell so the
          cross-fade replays on every switch. The view children already
          unmount/remount today (the conditional render below swaps element
          types), so mount semantics are unchanged — and nothing keyed here
          touches App-level state: polling incidents, the new-incident
          toast, and the announced-ID ref all live above this <main>, while
          handleNavigate still clears only selectedIncident (by design). */}
      <main key={view} className="flex-1 animate-view-in overflow-hidden">
        {showSettings ? (
          <Settings
            user={authState.user}
            onNavigate={handleNavigate}
            initialSection={usersEntry ? "users" : "account"}
          />
        ) : (
          <ControlRoom
            incidents={incidents}
            onSelectIncident={setSelectedIncident}
            initialAgency={authState.user.agency}
            newIncidentIds={newIncidentIds}
            onVisibleNewIncidents={handleVisibleNewIncidents}
            loading={loading}
            error={error}
            onRetry={refresh}
            selectedIncidentId={selectedIncident?.id ?? null}
          />
        )}
      </main>

      {newIncidentToast && (
        <NewIncidentToast
          toast={newIncidentToast}
          onClose={() => setNewIncidentToast(null)}
        />
      )}

      {selectedIncident && !isDispatchedFlow && (
        <TriageModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onDispatched={handleDispatched}
        />
      )}

      {isDispatchedFlow && (
        <DispatchTracker
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onResolved={handleResolved}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
}
