import { useEffect, useState } from "react";
import { CATEGORIES } from "../lib/config";
import { resolveIncident, markEnRoute, fetchRoute } from "../lib/api";
import RouteMap from "./RouteMap";

const STEPS = ["Pending", "Dispatched", "En Route", "Resolved"];

export default function DispatchTracker({ incident, onClose, onResolved, onStatusUpdated }) {
  const category = CATEGORIES[incident.category];

  // The assigned station's coords come from the TOP-LEVEL incident record
  // (incident.station.coords) — the backend exposes it there during Phase
  // 3, not under incident.dispatch. No hardcoded station positions.
  const stationCoords = incident.station?.coords;
  const { lat: fromLat, lng: fromLng } = stationCoords || {};
  const { lat: toLat, lng: toLng } = incident.coords || {};

  const [route, setRoute] = useState(null);

  // Fetch the real driving route whenever either endpoint moves. Keyed on
  // the primitive coord values (not object refs) so the 10s poll cycle
  // doesn't force a pointless re-fetch — a re-dispatched incident flows
  // in with new station coords and this effect re-runs automatically.
  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
        setRoute(null);
        return;
      }
      try {
        const result = await fetchRoute({ fromLat, fromLng, toLat, toLng });
        if (!cancelled) setRoute(result);
      } catch {
        // Backend down / route unavailable — RouteMap degrades to the
        // straight-line fallback and the metrics below show dashes.
        if (!cancelled) setRoute(null);
      }
    };

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [fromLat, fromLng, toLat, toLng]);

  // The stepper reflects the incident's REAL status field — never a
  // locally-guessed or hardcoded step index. Fall back to 0 if the
  // status doesn't match a known step (defensive; shouldn't happen).
  const currentStepIndex = (() => {
    const idx = STEPS.findIndex(
      (step) => step.toUpperCase() === (incident.status || "").toUpperCase(),
    );
    return idx >= 0 ? idx : 0;
  })();

  const [resolving, setResolving] = useState(false);
  const [markingEnRoute, setMarkingEnRoute] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await resolveIncident(incident.id);
    } catch {
      // Even if the network call fails, reflect the dispatcher's intent
      // locally and let the next poll reconcile — a dispatcher shouldn't
      // be blocked from marking something resolved by a flaky request.
    } finally {
      setResolving(false);
      onResolved(incident.id);
    }
  };

  const handleMarkEnRoute = async () => {
    setMarkingEnRoute(true);
    try {
      await markEnRoute(incident.id);
    } catch {
      // Same UX choice as resolve: reflect the dispatcher's intent
      // locally and let the next poll reconcile.
    } finally {
      setMarkingEnRoute(false);
      onStatusUpdated(incident.id, "En Route");
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
                } ${i === currentStepIndex ? "animate-step-pulse" : ""}`}
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
          <RouteMap
            stationCoords={stationCoords}
            incidentCoords={incident.coords}
            geometry={route?.geometry}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Distance</div>
            <div className="font-mono text-lg font-semibold">
              {route?.distanceMeters != null ? `${(route.distanceMeters / 1000).toFixed(1)} km` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Status</div>
            <div
              key={incident.status}
              className="animate-pop-in font-mono text-lg font-semibold"
              style={{ color: category.color }}
            >
              {incident.status}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">ETA</div>
            <div className="font-mono text-lg font-semibold">
              {route?.durationSeconds != null
                ? `~${Math.ceil(route.durationSeconds / 60)} min`
                : "—"}
            </div>
          </div>
        </div>

        <div key={incident.status} className="animate-slide-up p-4 pt-0">
          {incident.status === "DISPATCHED" && (
            <button
              onClick={handleMarkEnRoute}
              disabled={markingEnRoute}
              className="w-full rounded-md py-3 text-sm font-semibold transition-opacity active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#F59E0B", color: "#111A3A" }}
            >
              {markingEnRoute ? "Marking En Route…" : "MARK EN ROUTE"}
            </button>
          )}

          {incident.status.toUpperCase() === "EN ROUTE" && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="animate-button-flash w-full rounded-md bg-risk-low py-3 text-sm font-semibold text-bg transition-opacity active:scale-[0.98] disabled:opacity-60"
            >
              {resolving ? "Marking Resolved…" : "MARK RESOLVED"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
