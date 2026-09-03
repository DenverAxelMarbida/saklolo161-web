import { useEffect, useState } from "react";
import Header from "./components/Header";
import Login from "./components/Login";
import ControlRoom from "./components/ControlRoom";
import TriageModal from "./components/TriageModal";
import DispatchTracker from "./components/DispatchTracker";
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
  const { incidents, refresh } = useIncidentPolling();
  const [selectedIncident, setSelectedIncident] = useState(null);

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

  if (!authState) {
    return <Login onSuccess={() => {}} />;
  }

  const handleLogout = () => {
    // logout() clears localStorage and notifies the onAuthChange
    // subscription, which sets authState back to null and re-renders
    // Login. Nothing else needed here.
    logout();
  };

  // Once an incident reaches "Dispatched" it moves into the live-tracker
  // flow and stays there through "En Route" until "Resolved". Selecting a
  // modal by `status === "DISPATCHED"` exactly would bounce it back to the
  // Triage popup the moment "Mark En Route" advanced the status to
  // "EN ROUTE" — so branch on "at or past Dispatched" instead.
  const isDispatchedFlow =
    selectedIncident != null &&
    ["DISPATCHED", "EN ROUTE"].includes(selectedIncident.status);

  return (
    <div className="flex h-screen flex-col">
      <Header dutyOfficer={authState.user.email} onLogout={handleLogout} />

      <main className="flex-1 overflow-hidden">
        <ControlRoom
          incidents={incidents}
          onSelectIncident={setSelectedIncident}
          initialAgency={authState.user.agency}
        />
      </main>

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
