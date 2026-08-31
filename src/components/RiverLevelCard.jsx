import { useEffect, useState } from "react";
import { getWeatherRiver } from "../lib/api";
import { mockWeatherRiver } from "../data/mockIncidents";

function Sparkline({ points }) {
  const width = 240;
  const height = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Map each reading to an (x, y) pair inside the SVG's coordinate box.
  // This is the same math any sparkline lib does under the hood — for a
  // single 24hr line, a real charting dependency is overkill.
  const coords = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-10 w-full">
      <polyline
        points={coords}
        fill="none"
        stroke="var(--color-flood)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RiverLevelCard() {
  const [data, setData] = useState(mockWeatherRiver.river);

  useEffect(() => {
    getWeatherRiver()
      .then((res) => setData(res.river))
      .catch(() => setData(mockWeatherRiver.river));
  }, []);

  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-dim">River Level</span>
        <span className="rounded-full border border-flood/40 bg-flood/15 px-2 py-0.5 text-[11px] font-semibold text-flood">
          {data.status}
        </span>
      </div>
      <div className="mt-2 font-mono text-3xl font-semibold">{data.levelM}m</div>
      <Sparkline points={data.sparkline} />
      <div className="mt-1 text-[11px] text-ink-dim">Last 24 hours</div>
    </div>
  );
}
