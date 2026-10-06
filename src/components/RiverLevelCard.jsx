import { formatClock } from "../lib/format";

// Severity ladder mirrors the backend's own river classification
// (services/riverService.js: Normal -> Alert -> Alarm -> Critical). The
// meter is deliberately CSS-only — this card's contract is "a reading,
// not a chart" — and every class string is written out in full so the
// Tailwind scanner sees it.
const LEVELS = ["Normal", "Alert", "Alarm", "Critical"];

const SEVERITY = {
  Normal: {
    badge: "border-flood/40 bg-flood/15 text-flood",
    meter: "bg-flood",
  },
  Alert: {
    badge: "border-risk-mid/40 bg-risk-mid/15 text-risk-mid",
    meter: "bg-risk-mid",
  },
  Alarm: {
    badge: "border-risk-high/40 bg-risk-high/15 text-risk-high",
    meter: "bg-risk-high",
  },
  Critical: {
    badge: "border-risk-high/60 bg-risk-high/25 text-risk-high",
    meter: "bg-risk-high",
  },
};

const SEVERITY_FALLBACK = {
  badge: "border-flood/40 bg-flood/15 text-flood",
  meter: "bg-flood",
};

const SOURCE_LABEL = {
  pagasa: { text: "PAGASA feed", className: "text-ink-dim" },
  mock: { text: "Fallback data", className: "text-risk-mid" },
};

/**
 * Marikina River level monitor for the control-room sidebar.
 *
 * Props: `river` + `loading` (existing contract), plus `error` /
 * `onRetry` from useWeatherRiver for a real error state, and
 * `updatedAt` (the backend's response timestamp) for freshness.
 * Values, status, alert text, and feed source all come straight from
 * GET /api/weather-river — nothing is derived or invented.
 */
export default function RiverLevelCard({ river, loading, error, onRetry, updatedAt }) {
  const hasData = Boolean(river);
  const showAsError = !hasData && Boolean(error) && !loading;
  const severity = SEVERITY[river?.status] ?? SEVERITY_FALLBACK;
  const activeIndex = LEVELS.indexOf(river?.status);
  const source = SOURCE_LABEL[river?.source];
  const clock = formatClock(updatedAt);

  return (
    <div
      className="rounded-md border border-border bg-panel p-4"
      aria-busy={loading || (!hasData && !error)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-dim">River Level</span>
        {hasData && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}
          >
            {river.status}
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div className="mt-2 font-mono text-3xl font-semibold leading-none">
            {river.levelM}m
          </div>

          {/* Severity ladder — decorative reinforcement of the badge above
              (aria-hidden), so status never depends on color alone. */}
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {LEVELS.map((level, index) => (
              <span
                key={level}
                className={`h-1.5 flex-1 rounded-full ${
                  activeIndex >= 0 && index <= activeIndex ? severity.meter : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {river.alertLevel && (
            <p className="mt-2 text-[11px] text-ink-dim">{river.alertLevel}</p>
          )}

          {!loading && error && (
            <p className="mt-2 text-[11px] text-risk-mid">
              Update failed — showing the last reading.
            </p>
          )}

          {(source || clock) && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-2 text-[11px]">
              {source && <span className={source.className}>{source.text}</span>}
              {clock && <span className="text-ink-dim">Updated {clock}</span>}
            </div>
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
            <p className="text-sm font-medium text-risk-mid">River data unavailable</p>
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
        <>
          <div className="mt-2 animate-pulse font-mono text-3xl font-semibold text-ink-dim">
            —m
          </div>
          <div className="mt-1 text-[11px] text-ink-dim">Loading…</div>
        </>
      )}
    </div>
  );
}
