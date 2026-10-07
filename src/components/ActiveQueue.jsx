import { useMemo } from "react";
import { CATEGORIES, CATEGORY_KEYS } from "../lib/config";

const FILTERS = ["ALL", ...CATEGORY_KEYS];

const STATUS_STYLES = {
  PENDING: "text-ink-dim border-border",
  DISPATCHED: "text-medical border-medical/40",
  "EN ROUTE": "text-risk-mid border-risk-mid/40",
};

export default function ActiveQueue({
  incidents,
  onSelectIncident,
  activeFilter,
  onFilterChange,
  newIncidentIds = [],
  initialLoading = false,
  selectedIncidentId = null,
}) {
  const pending = useMemo(
    () => incidents.filter((i) => i.status !== "RESOLVED"),
    [incidents],
  );

  // useMemo here isn't about performance at this scale (a few dozen
  // rows) — it's about not recomputing the filtered list on every
  // unrelated re-render (e.g. a parent re-rendering for a map pan) when
  // neither `pending` nor `activeFilter` actually changed.
  const filtered = useMemo(() => {
    if (activeFilter === "ALL") return pending;
    return pending.filter((incident) => incident.category === activeFilter);
  }, [pending, activeFilter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">Active Queue</h2>
        <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-xs text-ink-dim">
          {pending.length} Pending
        </span>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto px-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            aria-pressed={activeFilter === filter}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? "border-transparent bg-ink text-bg"
                : "border-border text-ink-dim hover:border-ink-dim"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-1 pb-2">
        {initialLoading && (
          <div
            role="status"
            className="mt-6 rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-ink-dim"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-2 h-6 w-6 animate-pulse"
            >
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M3 13h5l1.5 2.5h5L16 13h5" />
            </svg>
            Loading incidents…
          </div>
        )}
        {!initialLoading && filtered.length === 0 && (
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
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M3 13h5l1.5 2.5h5L16 13h5" />
            </svg>
            No {activeFilter === "ALL" ? "" : activeFilter.toLowerCase()}{" "}
            incidents in queue.
          </div>
        )}
        {filtered.map((incident) => {
          const isNew = newIncidentIds.includes(incident.id);
          const isSelected = selectedIncidentId === incident.id;
          return (
            <button
              key={incident.id}
              onClick={() => onSelectIncident(incident)}
              data-selected={isSelected || undefined}
              className={`w-full rounded-md border p-3 text-left shadow-panel transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-raised${
                isSelected
                  ? " border-ink/50 bg-panel-hover ring-1 ring-ink/25"
                  : " border-border bg-panel hover:bg-panel-hover"
              }${isNew ? " animate-pop-in" : ""}`}
              style={{ borderLeft: `3px solid ${CATEGORIES[incident.category].color}` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-dim">#{incident.id}</span>
                <span className="font-mono text-xs text-ink-dim">{incident.elapsedMinutes}m ago</span>
              </div>
              <div className="mt-1 text-sm">{incident.location}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    STATUS_STYLES[incident.status] || STATUS_STYLES.PENDING
                  }`}
                >
                  {incident.status}
                </span>
                {isNew && (
                  <span className="inline-block rounded border border-risk-mid/50 bg-risk-mid/15 px-1.5 py-0.5 text-[10px] font-bold text-risk-mid">
                    New Incident
                  </span>
                )}
                {incident.evidenceUploading && (
                  <span
                    className="inline-block rounded border border-risk-mid/40 px-1.5 py-0.5 text-[10px] font-semibold text-risk-mid"
                    data-testid="queue-evidence-chip"
                  >
                    {incident.evidenceAttempt >= 2 && incident.evidenceAttemptsTotal > 0
                      ? `↻ retrying ${incident.evidenceAttempt}/${incident.evidenceAttemptsTotal}`
                      : `⏳ attaching evidence ${incident.evidence.length}/${incident.evidenceExpectedCount}`}
                  </span>
                )}
                {incident.evidenceFailedCount > 0 && (
                  <span
                    className="inline-block rounded border border-fire/40 px-1.5 py-0.5 text-[10px] font-semibold text-fire"
                    title={`${incident.evidenceFailedCount} attachment${
                      incident.evidenceFailedCount === 1 ? "" : "s"
                    } failed to upload`}
                  >
                    ⚠ {incident.evidenceFailedCount} failed
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
