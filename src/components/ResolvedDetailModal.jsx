import { CATEGORIES } from "../lib/config";
import MiniIncidentMap from "./MiniIncidentMap";

function formatResolvedDate(isoString) {
  if (!isoString) return "N/A";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Renders a single evidence entry. Backend entries are objects shaped
// { fileId, url, mimeType, uploadedAt }; the mock/fallback data paths can
// still carry plain filenames (strings). Per the Phase 3 evidence caveat,
// url is often "" until the Firebase Storage cutover — those entries must
// not render a broken preview, just their metadata.
function EvidenceEntry({ file }) {
  if (typeof file === "string") {
    return (
      <div className="rounded-md border border-border bg-bg p-2 text-xs text-ink-dim">
        {file}
      </div>
    );
  }

  const url = file?.url;
  const mimeType = (file?.mimeType || "").toLowerCase();
  const label = file?.fileId || "evidence file";

  if (!url) {
    return (
      <div className="rounded-md border border-border bg-bg p-2 text-xs text-ink-dim">
        {label}
      </div>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={label}
        className="max-h-48 w-full rounded-md border border-border object-cover"
      />
    );
  }

  if (mimeType.startsWith("video/")) {
    return <video src={url} controls className="max-h-48 w-full rounded-md border border-border" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-md border border-border bg-bg p-2 text-xs text-ink-dim hover:border-ink-dim"
    >
      {label}
    </a>
  );
}

function EvidenceSection({ evidence }) {
  const files = Array.isArray(evidence) ? evidence : [];
  if (files.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-ink-dim">Evidence</h3>
      <p className="mt-1 text-sm text-ink-dim">
        {files.length} evidence file{files.length === 1 ? "" : "s"}
      </p>
      <div className="mt-2 space-y-2">
        {files.map((file, i) => (
          <EvidenceEntry key={file?.fileId ?? i} file={file} />
        ))}
      </div>
    </div>
  );
}

export default function ResolvedDetailModal({ incident, onClose }) {
  const category = CATEGORIES[incident.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-2 py-1 text-xs font-semibold uppercase"
              style={{
                backgroundColor: `color-mix(in srgb, ${category?.color || "#334155"} 20%, transparent)`,
                color: category?.color || "#334155",
              }}
            >
              {category?.label || incident.category} EMERGENCY
            </span>
            <span className="font-mono text-sm text-ink-dim">#{incident.id}</span>
            <span className="rounded border border-resolved/40 bg-resolved/10 px-2 py-0.5 text-[11px] font-semibold text-resolved">
              RESOLVED
            </span>
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
            {/* Location */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Incident Location</h3>
              <p className="mt-1 text-sm font-semibold">{incident.location || "Unknown location"}</p>
            </div>

            {/* Caller Notes */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-ink-dim">Caller Notes</h3>
              <p className="mt-1 text-sm">{incident.callerNotes || "No notes provided."}</p>
            </div>

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

            {/* Evidence (citizen uploads) */}
            <EvidenceSection evidence={incident.evidence} />
          </div>
        </div>
      </div>
    </div>
  );
}
