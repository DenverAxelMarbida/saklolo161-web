import WeatherCard from "./WeatherCard";
import RiverLevelCard from "./RiverLevelCard";
import CategoryTally from "./CategoryTally";
import IncidentMap from "./IncidentMap";
import ActiveQueue from "./ActiveQueue";

export default function ControlRoom({ incidents, onSelectIncident }) {
  return (
    <div className="grid h-full grid-cols-[280px_1fr_320px] gap-3 p-3">
      <aside className="space-y-3 overflow-y-auto">
        <WeatherCard />
        <RiverLevelCard />
        <CategoryTally incidents={incidents} />
      </aside>

      <section className="overflow-hidden rounded-md border border-border">
        <IncidentMap incidents={incidents} onSelectIncident={onSelectIncident} />
      </section>

      <aside className="overflow-hidden rounded-md border border-border bg-panel/40 p-3">
        <ActiveQueue incidents={incidents} onSelectIncident={onSelectIncident} />
      </aside>
    </div>
  );
}
