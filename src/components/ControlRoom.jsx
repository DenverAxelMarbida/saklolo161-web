import { useEffect, useState } from "react";
import WeatherCard from "./WeatherCard";
import RiverLevelCard from "./RiverLevelCard";
import CategoryTally from "./CategoryTally";
import IncidentMap from "./IncidentMap";
import ActiveQueue from "./ActiveQueue";
import ResolvedLog from "./ResolvedLog";
import { useWeatherRiver } from "../hooks/useWeatherRiver";

export default function ControlRoom({
  incidents,
  onSelectIncident,
  initialAgency,
  newIncidentIds = [],
  onVisibleNewIncidents,
}) {
  // The category filter is shared between the queue, the map markers,
  // and the tally grid, so it lives here as ControlRoom state and is
  // passed down as props — not owned by any single child.
  //
  // Default it to the signed-in dispatcher's agency (a FIRE login lands
  // on a Fire-focused view). Admin (agency "ALL") or an undefined agency
  // fall back to seeing everything. Dispatchers can still switch filters
  // via the tally/queue buttons — this only changes the default on load.
  const [activeFilter, setActiveFilter] = useState(
    initialAgency && initialAgency !== "ALL" ? initialAgency : "ALL",
  );
  const [queueView, setQueueView] = useState("active");
  const [resolvedQuery, setResolvedQuery] = useState("");
  const { weather, river, loading } = useWeatherRiver();

  // Only surface a new incident to the toast when it would actually be
  // visible in this dispatcher's current view (category filter + not
  // resolved). The App layer dedupes IDs that were already toasted, so
  // re-running this effect on every poll is harmless; it also means an
  // incident becomes toastable the moment the dispatcher switches to a
  // filter that includes it.
  useEffect(() => {
    if (!onVisibleNewIncidents || newIncidentIds.length === 0) return;
    const visible = newIncidentIds
      .map((id) => incidents.find((incident) => incident.id === id))
      .filter(
        (incident) =>
          incident &&
          incident.status !== "RESOLVED" &&
          (activeFilter === "ALL" || incident.category === activeFilter),
      );
    if (visible.length > 0) onVisibleNewIncidents(visible);
  }, [newIncidentIds, incidents, activeFilter, onVisibleNewIncidents]);

  return (
    <div className="grid h-full grid-cols-[280px_1fr_320px] gap-3 p-3">
      <aside className="space-y-3 overflow-y-auto">
        <WeatherCard weather={weather} loading={loading} />
        <RiverLevelCard river={river} loading={loading} />
        <CategoryTally
          incidents={incidents}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />
      </aside>

      <section className="overflow-hidden rounded-md border border-border">
        <IncidentMap
          incidents={incidents}
          onSelectIncident={onSelectIncident}
          activeFilter={activeFilter}
        />
      </section>

      <aside className="overflow-hidden rounded-md border border-border bg-panel/40 p-3">
        <div className="mb-3 flex gap-1 px-1">
          {[
            { key: "active", label: "Active" },
            { key: "resolved", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setQueueView(tab.key)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                queueView === tab.key
                  ? tab.key === "resolved"
                    ? "border-transparent bg-resolved text-bg"
                    : "border-transparent bg-ink text-bg"
                  : "border-border text-ink-dim hover:border-ink-dim"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {queueView === "active" ? (
          <ActiveQueue
            incidents={incidents}
            onSelectIncident={onSelectIncident}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            newIncidentIds={newIncidentIds}
          />
        ) : (
          <div className="flex h-full flex-col">
            <input
              type="text"
              value={resolvedQuery}
              onChange={(e) => setResolvedQuery(e.target.value)}
              placeholder="Search resolved..."
              className="mb-3 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim/50 focus:border-ink-dim focus:outline-none"
            />
            <ResolvedLog incidents={incidents} query={resolvedQuery} />
          </div>
        )}
      </aside>
    </div>
  );
}
