import { CATEGORIES, CATEGORY_KEYS } from "../lib/config";
import Skeleton from "./Skeleton";

// Agency → visible category cards. There is no separate mapping table:
// agencies and categories share the same canonical keys (see
// UserManagement's AGENCIES = CATEGORY_KEYS + "ALL" and the backend's
// VALID_AGENCIES), so a restricted agency shows exactly its own card.
// "ALL" (admin), a missing agency, or an unknown value fall back to the
// full set — the same safe default ControlRoom already uses for the
// initial filter ("undefined agency falls back to seeing everything").
function resolveVisibleKeys(agency) {
  const key = typeof agency === "string" ? agency.trim().toUpperCase() : "";
  if (!key || key === "ALL" || !CATEGORIES[key]) return CATEGORY_KEYS;
  return [key];
}

// Counts are derived from the live `incidents` array on every render
// rather than tracked as their own state — this way the tally can never
// drift out of sync with the queue/map, since there's only one source
// of truth (the polled incidents list). Displaying fewer cards for a
// restricted agency changes only which cards render, never the counts
// themselves or the shared filter behavior behind them.
export default function CategoryTally({
  incidents,
  activeFilter,
  onSelectFilter,
  agency,
  loading = false,
}) {
  const visibleKeys = resolveVisibleKeys(agency);

  const counts = visibleKeys.reduce((acc, key) => {
    acc[key] = incidents.filter((i) => i.category === key && i.status !== "RESOLVED").length;
    return acc;
  }, {});

  return (
    <section aria-label="Incident categories" aria-busy={loading}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">Incident Categories</h2>
      </div>
      <div
        className={`grid gap-2 ${
          visibleKeys.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {visibleKeys.map((key) => {
          const isActive = key === activeFilter;
          return (
            <button
              key={key}
              onClick={() => onSelectFilter(isActive ? "ALL" : key)}
              aria-pressed={isActive}
              className={`rounded-md border p-3 text-left transition-colors ${
                isActive
                  ? "border-ink bg-panel-hover text-ink"
                  : "border-border bg-panel text-ink-dim hover:border-ink-dim"
              }`}
              style={{ borderLeft: `3px solid ${CATEGORIES[key].color}` }}
              title={isActive ? "Clear filter" : `Filter to ${CATEGORIES[key].label}`}
            >
              <div className="text-[11px] uppercase tracking-wide">
                {CATEGORIES[key].label}
              </div>
              {/* A zero count during the first fetch would read as "no
                  incidents" — show a pulsing placeholder until the real
                  number lands. */}
              <div className="font-mono text-2xl font-semibold">
                {loading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  String(counts[key]).padStart(2, "0")
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
