import { useState } from "react";
import { CATEGORIES } from "../lib/config";
import { resolveIncident } from "../lib/api";
import RouteMap from "./RouteMap";

const STEPS = ["Pending", "Dispatched", "En Route", "Resolved"];

// Static demo coords for the assigned station; a real build would get
// this from the station record returned by the backend.
const STATION_COORDS = { lat: 14.6455, lng: 121.101 };

export default function DispatchTracker({ incident, onClose, onResolved }) {
  const category = CATEGORIES[incident.category];
  const [currentStepIndex, setCurrentStepIndex] = useState(2); // demo: arrives already "En Route"
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await resolveIncident(incident.id);
    } catch {
      // Even if the network call fails, reflect the dispatcher's intent
      // locally and let the next poll reconcile — a dispatcher shouldn't
      // be blocked from marking something resolved by a flaky request.
    } finally {
      setCurrentStepIndex(3);
      setResolving(false);
      onResolved(incident.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Live Dispatch Tracker</span>
            <span className="font-mono text-sm text-ink-dim">#{incident.id}</span>
          </div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-border p-4">
          {STEPS.map((step, i) => (
            <div key={step} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i <= currentStepIndex ? "bg-risk-low text-bg" : "border border-border text-ink-dim"
                }`}
              >
                {i < currentStepIndex ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${i <= currentStepIndex ? "text-ink" : "text-ink-dim"}`}>
                {step}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="h-64 md:h-80">
          <RouteMap stationCoords={STATION_COORDS} incidentCoords={incident.coords} />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Distance</div>
            <div className="font-mono text-lg font-semibold">2.4 km</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Status</div>
            <div className="font-mono text-lg font-semibold" style={{ color: category.color }}>
              EN ROUTE
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">ETA</div>
            <div className="font-mono text-lg font-semibold">7 MIN</div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <button
            onClick={handleResolve}
            disabled={resolving || currentStepIndex === 3}
            className="w-full rounded-md bg-risk-low py-3 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            {currentStepIndex === 3 ? "RESOLVED" : resolving ? "Marking Resolved…" : "MARK RESOLVED"}
          </button>
        </div>
      </div>
    </div>
  );
}
