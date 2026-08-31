import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_KEYS } from "../lib/config";

const FILTERS = ["ALL", ...CATEGORY_KEYS];

const STATUS_STYLES = {
  PENDING: "text-ink-dim border-border",
  DISPATCHED: "text-medical border-medical/40",
  "EN ROUTE": "text-risk-mid border-risk-mid/40",
};

export default function ActiveQueue({ incidents, onSelectIncident }) {
  // The filter choice is UI-only state — it doesn't change what data we
  // have, only what subset of it we're currently looking at. That's the
  // signal it belongs in local useState rather than being threaded down
  // from a parent or baked into the fetch itself.
  const [activeFilter, setActiveFilter] = useState("ALL");

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
        <h2 className="font-semibold">Active Queue</h2>
        <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-xs text-ink-dim">
          {pending.length} Pending
        </span>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto px-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
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
        {filtered.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-dim">
            No {activeFilter === "ALL" ? "" : activeFilter.toLowerCase()} incidents in queue.
          </p>
        )}
        {filtered.map((incident) => (
          <button
            key={incident.id}
            onClick={() => onSelectIncident(incident)}
            className="w-full rounded-md border border-border bg-panel p-3 text-left transition-colors hover:bg-panel-hover"
            style={{ borderLeft: `3px solid ${CATEGORIES[incident.category].color}` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink-dim">#{incident.id}</span>
              <span className="font-mono text-xs text-ink-dim">{incident.elapsedMinutes}m ago</span>
            </div>
            <div className="mt-1 text-sm">{incident.location}</div>
            <span
              className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                STATUS_STYLES[incident.status] || STATUS_STYLES.PENDING
              }`}
            >
              {incident.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
