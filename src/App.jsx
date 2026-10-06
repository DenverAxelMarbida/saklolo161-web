import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Login from "./components/Login";
import ControlRoom from "./components/ControlRoom";
import UserManagement from "./components/UserManagement";
import Settings from "./components/Settings";
import TriageModal from "./components/TriageModal";
import DispatchTracker from "./components/DispatchTracker";
import NewIncidentToast from "./components/NewIncidentToast";
import { useIncidentPolling } from "./hooks/useIncidentPolling";
import { onAuthChange, logout } from "./lib/auth";

// The 3 screens map onto one small state machine:
//   selectedIncident === null            -> Screen 1 only
//   selectedIncident.status !== DISPATCHED -> Screen 1 + Triage modal (Screen 2)
//   selectedIncident.status === DISPATCHED -> Screen 1 + Tracker modal (Screen 3)
// Modeling it this way (one selected incident + its own status) means
// there's no separate "which screen" flag that could ever fall out of
// sync with the incident it's describing.
export default function App() {
  const [authState, setAuthState] = useState(null);
  const { incidents, refresh, newIncidentIds } = useIncidentPolling();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [newIncidentToast, setNewIncidentToast] = useState(null);
  // Three simple views: the Control Room (default), the admin-only
  // User Management page, and the all-roles Settings page. No router
  // — same single-screen state-switch pattern as ControlRoom's
  // queueView.
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

  if (!authState) {
    return <Login onSuccess={() => {}} />;
  }

  const handleLogout = () => {
    // logout() clears localStorage and notifies the onAuthChange
    // subscription, which sets authState back to null and re-renders
    // Login. Nothing else needed here.
    logout();
  };

  const handleNavigate = (nextView) => {
    // Switching views shouldn't leave a triage/tracker modal hanging
    // over the newly selected screen.
    setSelectedIncident(null);
    setView(nextView);
  };

  // Defense in depth: the Header only OFFERS the User Management
  // control to admins, but the view itself also refuses to render
  // for anyone but an admin (and the backend 403s every /api/users
  // call regardless — that's the real boundary). Settings is open
  // to both roles; only its User Management card is admin-gated.
  const showUsers = view === "users" && authState.user.role === "admin";
  const showSettings = view === "settings";

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
    <div className="flex h-screen flex-col">
      <Header
        dutyOfficer={authState.user.email}
        role={authState.user.role}
        view={view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-hidden">
        {showSettings ? (
          <Settings user={authState.user} onNavigate={handleNavigate} />
        ) : showUsers ? (
          <UserManagement />
        ) : (
          <ControlRoom
            incidents={incidents}
            onSelectIncident={setSelectedIncident}
            initialAgency={authState.user.agency}
            newIncidentIds={newIncidentIds}
            onVisibleNewIncidents={handleVisibleNewIncidents}
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
