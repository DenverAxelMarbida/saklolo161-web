import { useState } from "react";
import { CATEGORIES } from "../lib/config";
import { dispatchIncident } from "../lib/api";
import MiniIncidentMap from "./MiniIncidentMap";

export default function TriageModal({ incident, onClose, onDispatched }) {
  const category = CATEGORIES[incident.category];
  const [stationId, setStationId] = useState(category.stations[0].id);
  const [assignedUnit, setAssignedUnit] = useState(
    () => category.stations[0].assignedUnits[0] ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const station = category.stations.find((s) => s.id === stationId);

  // The unit dropdown always reflects the CURRENTLY selected station.
  // Default/seed it to that station's first unit whenever the station
  // changes, because a unit valid for one station is not guaranteed to
  // belong to another — the backend rejects unknown units at
  // dispatchController.js validation.
  const handleStationChange = (nextStationId) => {
    setStationId(nextStationId);
    const nextStation = category.stations.find((s) => s.id === nextStationId);
    setAssignedUnit(nextStation.assignedUnits[0] ?? "");
  };

  const handleDispatch = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await dispatchIncident({
        incidentId: incident.id,
        stationId,
        assignedUnit,
      });
      onDispatched({ ...incident, status: "DISPATCHED", stationId, assignedUnit });
    } catch (err) {
      // Surface the backend's real message for 4xx validation errors (it
      // tells the dispatcher exactly what's wrong, e.g. unknown unit). Only
      // fall back to a generic network message when there's no response at
      // all — i.e. a genuine connectivity/timeout failure.
      const payload = err?.response?.data;
      const serverMessage =
        payload?.message || (Array.isArray(payload?.errors) ? payload.errors.join(" ") : null);
      setErrorMsg(serverMessage || "Couldn't reach the dispatch server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-1 text-xs font-semibold uppercase"
              style={{ backgroundColor: `color-mix(in srgb, ${category.color} 20%, transparent)`, color: category.color }}
            >
              {category.label} EMERGENCY
            </span>
            <span className="font-mono text-sm text-ink-dim">#{incident.id}</span>
            {incident.priority === "HIGH" && (
              <span className="rounded border border-priority-high/40 bg-priority-high/15 px-2 py-0.5 text-[11px] font-semibold text-priority-high">
                HIGH PRIORITY
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body: two columns */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <div className="h-64 overflow-hidden rounded-md border border-border md:h-full">
            <MiniIncidentMap coords={incident.coords} />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Caller Notes</h3>
              <p className="mt-1 text-sm">{incident.callerNotes}</p>
            </div>

            {incident.evidence.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-ink-dim">Evidence</h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {incident.evidence.map((file) => (
                    <span
                      key={file}
                      className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-ink-dim"
                    >
                      📎 {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station">
                Dispatch To
              </label>
              {/* Populated dynamically from CATEGORIES[incident.category].stations —
                  swapping the incident's category swaps the whole option list. */}
              <select
                id="station"
                value={stationId}
                onChange={(e) => handleStationChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              >
                {category.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="unit">
                Assigned Unit
              </label>
              {/* Options populated from the SELECTED station's assignedUnits;
                  reset to its first unit whenever station changes. */}
              <select
                id="unit"
                value={assignedUnit}
                onChange={(e) => setAssignedUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              >
                {(station.assignedUnits ?? []).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {errorMsg && <p className="text-sm text-fire">{errorMsg}</p>}
          </div>
        </div>

        {/* Footer action */}
        <div className="border-t border-border p-4">
          <button
            onClick={handleDispatch}
            disabled={submitting}
            className="w-full rounded-md py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: category.color }}
          >
            {submitting ? "Dispatching…" : `DISPATCH ${station.name.toUpperCase()} UNIT ➔`}
          </button>
        </div>
      </div>
    </div>
  );
}
