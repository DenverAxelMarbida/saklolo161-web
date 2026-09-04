import { useMemo } from "react";
import { CATEGORIES } from "../lib/config";

export default function ResolvedLog({ incidents, query }) {
  const resolved = useMemo(
    () =>
      incidents
        .filter((i) => i.status === "RESOLVED")
        .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes),
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
        <p className="mt-6 text-center text-sm text-ink-dim">
          No resolved incidents yet.
        </p>
      )}
      {filtered.map((incident) => (
        <div
          key={incident.id}
          className="mb-2 w-full rounded-md border border-border bg-panel p-3 text-left"
          style={{ borderLeft: `3px solid ${CATEGORIES[incident.category].color}` }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-ink-dim">#{incident.id}</span>
            <span className="font-mono text-xs text-ink-dim">
              {incident.elapsedMinutes ? `${incident.elapsedMinutes}m ago` : "Resolved"}
            </span>
          </div>
          <div className="mt-1 text-sm">{incident.location}</div>
          <span className="mt-2 inline-block rounded border border-resolved/40 bg-resolved/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-resolved">
            {incident.category} · Resolved
          </span>
        </div>
      ))}
    </div>
  );
}
