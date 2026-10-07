import { useRef, useState } from "react";
import { CATEGORIES } from "../lib/config";
import { dispatchIncident, normalizeIncident } from "../lib/api";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import MiniIncidentMap from "./MiniIncidentMap";
import EvidenceGallery from "./EvidenceGallery";

// WCAG relative luminance for a "#rrggbb" hex (config category colors).
const luminance = (hex) => {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)
    .map((chunk) => parseInt(chunk, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Ink that stays WCAG-AA readable on a given category color: no single
// text color passes 4.5:1 against all four category colors (the light
// orange/blue/red need dark ink, the dark slate needs white), so the
// dispatch button picks its ink per background.
const inkClassFor = (bgHex) => (luminance(bgHex) > 0.179 ? "text-bg" : "text-white");

export default function TriageModal({ incident, onClose, onDispatched }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onClose);

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
      const res = await dispatchIncident({
        incidentId: incident.id,
        stationId,
        assignedUnit,
      });

      // The dispatch response already carries the authoritative state —
      // most importantly the assigned station's `coords` (contract anchor:
      // _incident.station.coords_ at the TOP level). Passing it through
      // normalized means the Live Dispatch Tracker opens WITH the station
      // so Distance/ETA render instantly and the real route fetch starts
      // immediately, instead of inheriting the Pending card's `station: null`.
      onDispatched(normalizeIncident(res.data));
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
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Triage incident #${incident.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl animate-pop-in flex-col overflow-hidden rounded-lg border border-border bg-panel">
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
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

            {(incident.evidence.length > 0 ||
              incident.evidenceUploading ||
              incident.evidenceExpectedCount > 0) && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-ink-dim">Evidence</h3>
                <div className="mt-1.5">
                  {incident.evidence.length > 0 && (
                    <EvidenceGallery evidence={incident.evidence} />
                  )}

                  {incident.evidenceUploading && (
                    <div className="mt-2 rounded border border-risk-mid/40 bg-risk-mid/10 p-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-risk-mid">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-risk-mid" />
                        {incident.evidenceAttempt >= 2 &&
                        incident.evidenceAttemptsTotal > 0
                          ? `Evidence retrying — attempt ${incident.evidenceAttempt}/${incident.evidenceAttemptsTotal}`
                          : `Attaching evidence ${incident.evidence.length}/${incident.evidenceExpectedCount}…`}
                      </p>
                      {/* Honest file-count progress only — never a fabricated byte %:
                          this client has no per-byte telemetry from the citizen's phone. */}
                      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-risk-mid/25">
                        <div
                          className="h-full bg-risk-mid transition-all"
                          style={{
                            width: `${
                              incident.evidenceExpectedCount > 0
                                ? (incident.evidence.length / incident.evidenceExpectedCount) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {incident.evidenceFailedCount > 0 && !incident.evidenceUploading && (
                    <p className="mt-2 text-xs font-medium text-fire">
                      ⚠ {incident.evidenceFailedCount} attachment
                      {incident.evidenceFailedCount === 1 ? "" : "s"} failed to upload — the
                      report still came through.
                    </p>
                  )}

                  {!incident.evidenceUploading &&
                    incident.evidenceFailedCount === 0 &&
                    incident.evidenceExpectedCount > 0 &&
                    incident.evidence.length >= incident.evidenceExpectedCount && (
                      <p className="mt-2 text-xs font-medium text-resolved" data-testid="evidence-done">
                        ✓ {incident.evidence.length} attachment
                        {incident.evidence.length === 1 ? "" : "s"} uploaded
                      </p>
                    )}
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
            className={`w-full rounded-md py-3 text-sm font-semibold transition-opacity disabled:opacity-60 ${inkClassFor(category.color)}`}
            style={{ backgroundColor: category.color }}
          >
            {submitting ? "Dispatching…" : `DISPATCH ${station.name.toUpperCase()} UNIT ➔`}
          </button>
        </div>
      </div>
    </div>
  );
}
