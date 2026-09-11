import { useEffect, useState } from "react";
import { resolveIncident, markEnRoute, fetchRoute } from "../lib/api";
import { straightLineEstimate } from "../lib/geo";
import RouteMap from "./RouteMap";

const STEPS = ["Pending", "Dispatched", "En Route", "Resolved"];

export default function DispatchTracker({ incident, onClose, onResolved, onStatusUpdated }) {

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

  // The station (and its coords) live at the TOP level of the incident,
  // not under `dispatch` — the backend exposes station.coords there.
  const stationCoords = incident.station?.coords ?? null;

  // Distance/ETA come from the same GET /api/routes payload the map
  // draws. Re-fetched whenever either endpoint's coords actually change
  // (e.g. an incident re-dispatched to another station lands through the
  // poll cycle); leave null until the route arrives so the UI degrades
  // to "—" instead of a stale hardcoded number.
  const [route, setRoute] = useState(null);

  const stationLat = stationCoords?.lat;
  const stationLng = stationCoords?.lng;
  const incidentLat = incident.coords?.lat;
  const incidentLng = incident.coords?.lng;

  // The real route (GET /api/routes) is a Mapbox round-trip and can take
  // a moment. Show the straight-line estimate at ~40 km/h INSTANTLY so
  // Distance/ETA never sit on "—", then let the real numbers replace it.
  const provisional =
    stationLat != null && stationLng != null && incidentLat != null && incidentLng != null
      ? straightLineEstimate(stationLat, stationLng, incidentLat, incidentLng)
      : null;
  const distanceMeters = route?.distanceMeters ?? provisional?.distanceMeters;
  const durationSeconds = route?.durationSeconds ?? provisional?.durationSeconds;

  useEffect(() => {
    if (
      stationLat == null ||
      stationLng == null ||
      incidentLat == null ||
      incidentLng == null
    ) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setRoute(null);

    fetchRoute({
      fromLat: stationLat,
      fromLng: stationLng,
      toLat: incidentLat,
      toLng: incidentLng,
    })
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
      })
      .catch(() => {
        // Leave route null; the tracker renders "—" placeholders and the
        // map keeps the straight-line fallback until the next poll tick
        // re-drives coords/refresh.
      });

    return () => {
      cancelled = true;
    };
  }, [stationLat, stationLng, incidentLat, incidentLng]);

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

        <div className="grid grid-cols-4 gap-3 border-t border-border p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Distance</div>
            <div className="font-mono text-lg font-semibold">
              {distanceMeters != null
                ? `${(distanceMeters / 1000).toFixed(1)} km`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Status</div>
            <div
              key={incident.status}
              className="animate-pop-in font-mono text-lg font-semibold text-ink"
            >
              {incident.status}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">ETA</div>
            <div className="font-mono text-lg font-semibold">
              {durationSeconds != null
                ? `~${Math.round(durationSeconds / 60)} min`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Turnout</div>
            <div className="font-mono text-lg font-semibold">
              {incident.dispatch?.estimatedTurnout ?? "—"}
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