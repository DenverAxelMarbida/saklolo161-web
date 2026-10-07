import { formatClock } from "../lib/format";

// Tailwind v4 turns each `--color-*` token in @theme into a same-named
// utility, so --color-risk-low becomes classes like `bg-risk-low`.
// Class strings are written out in full (never interpolated) so the
// Tailwind scanner can see every one it needs to generate.
const RISK_BADGE = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/40",
  MEDIUM: "bg-risk-mid/15 text-risk-mid border-risk-mid/40",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/40",
};

const RISK_TILE = {
  LOW: "border-risk-low/30 bg-risk-low/10 text-risk-low",
  MEDIUM: "border-risk-mid/30 bg-risk-mid/10 text-risk-mid",
  HIGH: "border-risk-high/30 bg-risk-high/10 text-risk-high",
};

const RISK_FALLBACK_BADGE = "bg-white/5 text-ink-dim border-border";
const RISK_FALLBACK_TILE = "border-border bg-white/5 text-ink-dim";

// Condition glyphs, matched against the API's own `condition` text
// (OpenWeather main values like "Thunderstorm", plus the backend's
// "Partly Cloudy" fallback). Inline SVG — no emoji, no icon font, and
// nothing that costs a network request on the sign-in-critical path.
// Mobile (HomeDashboard.js) maps the same condition strings to the
// same semantic keys — keep the two in sync.
function conditionKey(condition = "") {
  const c = String(condition).toLowerCase();
  if (/thunder|storm|tornado|squall/.test(c)) return "storm";
  if (/drizzle/.test(c)) return "drizzle";
  if (/rain|shower/.test(c)) return "rain";
  if (/snow|sleet|hail/.test(c)) return "snow";
  if (/fog|mist|haze|smoke|smog|dust|sand|ash/.test(c)) return "fog";
  if (/clear|sun/.test(c)) return "clear";
  if (/partly/.test(c)) return "partly";
  if (/cloud|overcast/.test(c)) return "cloud";
  // Unknown/unexpected text always degrades to the neutral cloud.
  return "cloud";
}

const CONDITION_ART = {
  clear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: <path d="M17.5 19a4.5 4.5 0 0 0 .4-8.98A6 6 0 0 0 6.2 11.2 3.9 3.9 0 0 0 7 19z" />,
  partly: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M7.5 2v1.4M7.5 9.6V11M3 6.5H1.6M13.4 6.5H12M4.3 3.3l1 1M10.7 8.6l1 1M4.3 9.7l1-1M10.7 4.4l1-1" />
      <path d="M18.5 19.5a3.6 3.6 0 0 0 .3-7.17A5.1 5.1 0 0 0 9.2 13.2a3.4 3.4 0 0 0 .7 6.3z" />
    </>
  ),
  rain: (
    <>
      <path d="M17 15a4 4 0 0 0 .4-7.96A5.5 5.5 0 0 0 6.5 11.2 3.5 3.5 0 0 0 7 15" />
      <path d="M8 17.5 7 20M12 17.5 11 20M16 17.5 15 20" />
    </>
  ),
  drizzle: (
    <>
      <path d="M17 15a4 4 0 0 0 .4-7.96A5.5 5.5 0 0 0 6.5 11.2 3.5 3.5 0 0 0 7 15" />
      <path d="M8.5 17.5v1.5M12.5 17.5v1.5M16.5 17.5v1.5" />
    </>
  ),
  storm: (
    <>
      <path d="M17 13.5a4 4 0 0 0 .4-7.96A5.5 5.5 0 0 0 6.5 9.7 3.5 3.5 0 0 0 7 13.5" />
      <path d="m13 12-2.5 4.5H13L11.5 21" />
    </>
  ),
  snow: (
    <>
      <path d="M17 14a4 4 0 0 0 .4-7.96A5.5 5.5 0 0 0 6.5 8.7 3.5 3.5 0 0 0 7 14" />
      <path d="M8 17.5h.01M12 19.5h.01M16 17.5h.01" />
    </>
  ),
  fog: (
    <>
      <path d="M17 11.5a4 4 0 0 0 .4-7.96A5.5 5.5 0 0 0 6.5 6.2 3.5 3.5 0 0 0 7 11.5" />
      <path d="M5 15.5h14M7 19h10" />
    </>
  ),
};

/**
 * Operational weather snapshot for the control-room sidebar.
 *
 * Props: `weather` + `loading` (existing contract), plus `error` /
 * `onRetry` from useWeatherRiver so a failed fetch reads as a real error
 * state instead of an endless "Loading…". No data is ever invented —
 * everything rendered comes from GET /api/weather-river.
 */
export default function WeatherCard({ weather, loading, error, onRetry, updatedAt }) {
  const hasData = Boolean(weather);
  const showAsError = !hasData && Boolean(error) && !loading;
  const badge = RISK_BADGE[weather?.risk] ?? RISK_FALLBACK_BADGE;
  const tile = RISK_TILE[weather?.risk] ?? RISK_FALLBACK_TILE;
  const clock = formatClock(updatedAt);

  return (
    <div
      className="rounded-md border border-border bg-panel p-4"
      aria-busy={loading || (!hasData && !error)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-dim">Weather</span>
        {hasData && weather.risk && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge}`}
          >
            {weather.risk} RISK
          </span>
        )}
      </div>

      {hasData ? (
        <>
          {/* Compact row: the small graphic supports the temperature
              instead of competing with it — weather is informational,
              not the dashboard's focal point. */}
          <div className="mt-3 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tile}`}
            >
              <svg
                aria-hidden="true"
                data-condition={conditionKey(weather.condition)}
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {CONDITION_ART[conditionKey(weather.condition)]}
              </svg>
            </span>
            <div className="min-w-0">
              <div className="font-mono text-2xl font-semibold leading-none">
                {weather.tempC}°C
              </div>
              <div className="mt-0.5 truncate text-[13px] text-ink-dim">{weather.condition}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                Humidity
              </div>
              <div className="mt-0.5 truncate font-mono text-sm">{weather.humidity}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                Wind
              </div>
              <div className="mt-0.5 truncate font-mono text-sm">{weather.wind}</div>
            </div>
          </div>

          {!loading && error && (
            <p className="mt-2 text-[11px] text-risk-mid">
              Update failed — showing the last reading.
            </p>
          )}

          {clock && (
            <p className="mt-2 text-[11px] text-ink-dim">Updated {clock}</p>
          )}
        </>
      ) : showAsError ? (
        <div className="mt-3 rounded-md border border-risk-mid/40 bg-risk-mid/10 p-3">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-risk-mid"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p className="text-sm font-medium text-risk-mid">Weather data unavailable</p>
          </div>
          <p className="mt-1 text-xs text-ink-dim">Couldn't reach the monitoring feed.</p>
          {typeof onRetry === "function" && (
            <button
              onClick={onRetry}
              className="mt-2.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-ink transition-colors hover:border-medical/40 hover:text-medical"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-baseline gap-2 animate-pulse">
          <span className="font-mono text-3xl font-semibold text-ink-dim">—°C</span>
          <span className="text-sm text-ink-dim">Loading…</span>
        </div>
      )}
    </div>
  );
}
