import { useState } from "react";
import Header from "./components/Header";
import ControlRoom from "./components/ControlRoom";
import TriageModal from "./components/TriageModal";
import DispatchTracker from "./components/DispatchTracker";
import { useIncidentPolling } from "./hooks/useIncidentPolling";

// The 3 screens map onto one small state machine:
//   selectedIncident === null            -> Screen 1 only
//   selectedIncident.status !== DISPATCHED -> Screen 1 + Triage modal (Screen 2)
//   selectedIncident.status === DISPATCHED -> Screen 1 + Tracker modal (Screen 3)
// Modeling it this way (one selected incident + its own status) means
// there's no separate "which screen" flag that could ever fall out of
// sync with the incident it's describing.
export default function App() {
  const { incidents, refresh } = useIncidentPolling();
  const [selectedIncident, setSelectedIncident] = useState(null);

  const handleDispatched = (updatedIncident) => {
    setSelectedIncident(updatedIncident);
    refresh(); // pull the authoritative state immediately rather than waiting up to 10s
  };

  const handleResolved = () => {
    setSelectedIncident(null);
    refresh();
  };

  return (
    <div className="flex h-screen flex-col">
      <Header />

      <main className="flex-1 overflow-hidden">
        <ControlRoom incidents={incidents} onSelectIncident={setSelectedIncident} />
      </main>

      {selectedIncident && selectedIncident.status !== "DISPATCHED" && (
        <TriageModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onDispatched={handleDispatched}
        />
      )}

      {selectedIncident && selectedIncident.status === "DISPATCHED" && (
        <DispatchTracker
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
