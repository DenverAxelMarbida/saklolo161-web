import { useEffect, useRef, useState } from "react";
import { resolveIncident, markEnRoute, fetchRoute } from "../lib/api";
import { straightLineEstimate } from "../lib/geo";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import RouteMap from "./RouteMap";

const STEPS = ["Pending", "Dispatched", "En Route", "Resolved"];

export default function DispatchTracker({ incident, onClose, onResolved, onStatusUpdated }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onClose);

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
  const [actionError, setActionError] = useState(null);

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
    setActionError(null);
    try {
      await resolveIncident(incident.id);
      setResolving(false);
      onResolved(incident.id);
    } catch {
      // A failed request must stay visible: closing the tracker anyway
      // would show a false success. The modal stays open, the stepper
      // keeps showing the server's real status, and the message below
      // tells the dispatcher nothing was saved (the 10s poll keeps
      // reconciling either way).
      setResolving(false);
      setActionError(
        "Couldn't save that change. Check your connection and try again.",
      );
    }
  };

  const handleMarkEnRoute = async () => {
    setMarkingEnRoute(true);
    setActionError(null);
    try {
      await markEnRoute(incident.id);
      setMarkingEnRoute(false);
      onStatusUpdated(incident.id, "En Route");
    } catch {
      // Same as resolve: no silent optimistic flip — the status stays
      // at the server's truth and the message below explains why.
      setMarkingEnRoute(false);
      setActionError(
        "Couldn't save that change. Check your connection and try again.",
      );
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Live Dispatch Tracker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl animate-pop-in flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Live Dispatch Tracker</span>
            <span className="font-mono text-sm text-ink-dim">#{incident.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
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
          {/* Full-width stat cell: the citizen contact belongs with the
              incident facts, rendered from the same canonical
              `citizenPhone` the backend returns. */}
          <div className="col-span-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">Phone Number</div>
            <div className="font-mono text-lg font-semibold">
              {incident.citizenPhone || "—"}
            </div>
          </div>
        </div>

        <div key={incident.status} className="animate-slide-up p-4 pt-0">
          {incident.status === "DISPATCHED" && (
            <button
              onClick={handleMarkEnRoute}
              disabled={markingEnRoute}
              className="w-full rounded-md bg-risk-mid py-3 text-sm font-semibold text-header transition-opacity active:scale-[0.98] disabled:opacity-60"
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

          {actionError && (
            <p role="alert" className="mt-2 text-center text-xs text-fire">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}