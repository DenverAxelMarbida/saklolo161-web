import { useState } from "react";
import WeatherCard from "./WeatherCard";
import RiverLevelCard from "./RiverLevelCard";
import CategoryTally from "./CategoryTally";
import IncidentMap from "./IncidentMap";
import ActiveQueue from "./ActiveQueue";
import ResolvedLog from "./ResolvedLog";

export default function ControlRoom({ incidents, onSelectIncident, initialAgency }) {
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

  return (
    <div className="grid h-full grid-cols-[280px_1fr_320px] gap-3 p-3">
      <aside className="space-y-3 overflow-y-auto">
        <WeatherCard />
        <RiverLevelCard />
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
                  ? "border-transparent bg-ink text-bg"
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
