import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../lib/config";
import ResolvedDetailModal, { formatResolvedDate } from "./ResolvedDetailModal";

// Epoch for anything without a usable resolvedAt (null/undefined/garbage)
// so pre-contract records sort below timed ones without ever crashing the
// comparator. resolvedAt is the ONLY ordering key — never updatedAt.
function resolvedTime(incident) {
  const t = Date.parse(incident?.resolvedAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

export default function ResolvedLog({ incidents, query }) {
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Keep the open modal pointed at the freshest polled copy of that
  // incident, mirroring App.jsx's selectedIncident sync. Evidence can
  // arrive AFTER the row was clicked (a citizen's late upload/retry) —
  // a frozen snapshot would hide it until the modal is closed and
  // reopened, which the dispatcher should never have to do.
  useEffect(() => {
    if (!selectedIncident) return;
    const fresh = incidents.find((i) => i.id === selectedIncident.id);
    if (fresh && fresh !== selectedIncident) setSelectedIncident(fresh);
  }, [incidents, selectedIncident]);
  const resolved = useMemo(
    () =>
      incidents
        .filter((i) => i.status === "RESOLVED")
        // Most recently resolved first: the dispatcher's latest action
        // lands at the top of the log (recency), instead of sinking to
        // the bottom behind every older resolution. `elapsedMinutes`
        // tracks time since REPORT, so it can't order resolutions —
        // `resolvedAt` is the authoritative key (epoch fallback keeps
        // pre-contract records in their incoming order).
        .sort((a, b) => resolvedTime(b) - resolvedTime(a)),
    [incidents],
  );

  const filtered = useMemo(() => {
    if (!query) return resolved;
    const q = query.toLowerCase();
    return resolved.filter(
      (i) =>
        i.id.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [resolved, query]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-1 pb-2">
      {filtered.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-ink-dim">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-2 h-6 w-6"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          No resolved incidents yet.
        </div>
      )}
      {filtered.map((incident) => (
        <button
          key={incident.id}
          onClick={() => setSelectedIncident(incident)}
          className="mb-2 w-full rounded-md border border-border bg-panel px-3.5 py-3 text-left shadow-panel transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-panel-hover hover:shadow-raised"
          style={{ borderLeft: `3px solid ${CATEGORIES[incident.category].color}` }}
        >
          {/* Metadata row: muted ID left, slightly stronger resolved
              timestamp right — wraps as a pair on narrow rails instead
              of overflowing. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="font-mono text-xs text-ink-dim">#{incident.id}</span>
            <span className="font-mono text-xs text-ink">
              Resolved {formatResolvedDate(incident.resolvedAt)}
            </span>
          </div>
          {/* Decorative rule: separates "which incident / when" from
              "where / what status" using the existing border token. */}
          <div aria-hidden="true" className="mt-2.5 h-px bg-border" />
          {/* Address is the card's primary content: it gets the air
              above it, wraps naturally, and is never truncated. */}
          <div className="mt-2.5 text-sm leading-snug break-words">{incident.location}</div>
          <span className="mt-2.5 inline-block rounded border border-resolved/40 bg-resolved/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-resolved">
            {incident.category} · Resolved
          </span>
        </button>
      ))}

      {selectedIncident && (
        <ResolvedDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
