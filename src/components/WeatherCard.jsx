// Tailwind v4 turns each `--color-*` token in @theme into a same-named
// utility, so --color-risk-low becomes classes like `bg-risk-low`.
const RISK_COLORS = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/40",
  MEDIUM: "bg-risk-mid/15 text-risk-mid border-risk-mid/40",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/40",
};

export default function WeatherCard({ weather, loading }) {
  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-dim">Weather</span>
        {!loading && weather && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RISK_COLORS[weather.risk]}`}
          >
            {weather.risk} RISK
          </span>
        )}
      </div>
      {loading || !weather ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold text-ink-dim">—°C</span>
          <span className="text-sm text-ink-dim">Loading…</span>
        </div>
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold">{weather.tempC}°C</span>
          <span className="text-sm text-ink-dim">{weather.condition}</span>
        </div>
      )}
    </div>
  );
}
