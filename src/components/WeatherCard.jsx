import { useEffect, useState } from "react";
import { getWeatherRiver } from "../lib/api";
import { mockWeatherRiver } from "../data/mockIncidents";

// Tailwind v4 turns each `--color-*` token in @theme into a same-named
// utility, so --color-risk-low becomes classes like `bg-risk-low`.
const RISK_COLORS = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/40",
  MEDIUM: "bg-risk-mid/15 text-risk-mid border-risk-mid/40",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/40",
};

export default function WeatherCard() {
  const [data, setData] = useState(mockWeatherRiver.weather);

  useEffect(() => {
    // One-time fetch on mount. Weather doesn't need 10s polling like
    // incidents do — river/weather conditions change slowly, so this
    // effect intentionally has no interval, just an empty-deps fetch.
    getWeatherRiver()
      .then((res) => setData(res.weather))
      .catch(() => setData(mockWeatherRiver.weather));
  }, []);

  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-dim">Weather</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RISK_COLORS[data.risk]}`}
        >
          {data.risk} RISK
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold">{data.tempC}°C</span>
        <span className="text-sm text-ink-dim">{data.condition}</span>
      </div>
    </div>
  );
}
