import { useRef } from "react";
import { CATEGORIES } from "../lib/config";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import MiniIncidentMap from "./MiniIncidentMap";
import EvidenceGallery from "./EvidenceGallery";
import { chipInkStyle } from "./TriageModal";

// Single source of truth for the web's resolved-date convention —
// exported so the Resolved Log cards render the exact same string.
export function formatResolvedDate(isoString) {
  // Graceful em dash (same convention as the phone/location fallbacks)
  // instead of the literal "N/A" that used to render in the Resolved row.
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResolvedDetailModal({ incident, onClose }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onClose);
  const category = CATEGORIES[incident.category];

  // Real media renders inline when `url` is served; legacy records with an
  // empty url (pre-storage uploads) degrade to a labeled pill rather than
  // disappearing silently.
  const evidence = incident.evidence || [];
  // Last successfully stored attachment, from the server's own
  // `uploadedAt` (per-file receive time — nothing client-side).
  const lastUploadedMs = evidence
    .map((e) => (e.uploadedAt ? new Date(e.uploadedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
    .pop();

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Resolved incident #${incident.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl animate-pop-in flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-1 text-xs font-semibold uppercase"
              style={{
                backgroundColor: `color-mix(in srgb, ${category?.color || "#334155"} 20%, transparent)`,
                ...chipInkStyle(category?.color || "#334155"),
              }}
            >
              {category?.label || incident.category} EMERGENCY
            </span>
            <span className="font-mono text-sm text-ink-dim">#{incident.id}</span>
            <span className="rounded border border-resolved/40 bg-resolved/10 px-2 py-0.5 text-[11px] font-semibold text-resolved">
              RESOLVED
            </span>
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
            {/* Location */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Incident Location</h3>
              <p className="mt-1 text-sm font-semibold">{incident.location || "Unknown location"}</p>
            </div>

            {/* Citizen contact — same canonical field as every other view */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Phone Number</h3>
              <p className="mt-1 text-sm font-semibold">{incident.citizenPhone || "—"}</p>
            </div>

            {/* Caller Notes */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Caller Notes</h3>
              <p className="mt-1 text-sm">{incident.callerNotes || "No notes provided."}</p>
            </div>

            {/* Evidence */}
            {evidence.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-ink-dim">Evidence</h3>
                <p className="mt-1 text-xs text-ink-dim">
                  {evidence.length} evidence file{evidence.length !== 1 ? "s" : ""}
                </p>
                {lastUploadedMs != null && (
                  <p className="mt-0.5 text-xs text-ink-dim" data-testid="last-uploaded">
                    Last uploaded {formatResolvedDate(new Date(lastUploadedMs).toISOString())}
                  </p>
                )}
                <div className="mt-2">
                  <EvidenceGallery evidence={evidence} />
                </div>
              </div>
            )}

            {/* Dispatch Location */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Dispatched From</h3>
              <p className="mt-1 text-sm">
                {incident.dispatch?.stationName || "Not yet dispatched"}
              </p>
            </div>

            {/* Assigned Unit */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Assigned Unit</h3>
              <p className="mt-1 text-sm">
                {incident.dispatch?.assignedUnit || "Not yet dispatched"}
              </p>
            </div>

            {/* Resolved Date */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Resolved</h3>
              <p className="mt-1 text-sm font-semibold text-resolved">
                {formatResolvedDate(incident.resolvedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
