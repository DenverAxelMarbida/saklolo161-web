import { CATEGORIES, CATEGORY_KEYS } from "../lib/config";

// Counts are derived from the live `incidents` array on every render
// rather than tracked as their own state — this way the tally can never
// drift out of sync with the queue/map, since there's only one source
// of truth (the polled incidents list).
export default function CategoryTally({ incidents }) {
  const counts = CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = incidents.filter((i) => i.category === key && i.status !== "RESOLVED").length;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORY_KEYS.map((key) => (
        <div
          key={key}
          className="rounded-md border border-border bg-panel p-3"
          style={{ borderLeft: `3px solid ${CATEGORIES[key].color}` }}
        >
          <div className="text-[11px] uppercase tracking-wide text-ink-dim">
            {CATEGORIES[key].label}
          </div>
          <div className="font-mono text-2xl font-semibold">
            {String(counts[key]).padStart(2, "0")}
          </div>
        </div>
      ))}
    </div>
  );
}
