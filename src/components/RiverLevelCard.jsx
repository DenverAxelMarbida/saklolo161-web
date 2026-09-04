function Sparkline({ points }) {
  const safePoints = points && points.length > 1 ? points : [0, 0];
  const width = 240;
  const height = 40;
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = max - min || 1;

  // Map each reading to an (x, y) pair inside the SVG's coordinate box.
  // This is the same math any sparkline lib does under the hood — for a
  // single 24hr line, a real charting dependency is overkill.
  const coords = safePoints
    .map((value, i) => {
      const x = (i / (safePoints.length - 1)) * width;
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

export default function RiverLevelCard({ river, loading }) {
  return (
    <div className="rounded-md border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-dim">River Level</span>
        {!loading && river && (
          <span className="rounded-full border border-flood/40 bg-flood/15 px-2 py-0.5 text-[11px] font-semibold text-flood">
            {river.status}
          </span>
        )}
      </div>
      {loading || !river ? (
        <>
          <div className="mt-2 font-mono text-3xl font-semibold text-ink-dim">—m</div>
          <Sparkline points={null} />
          <div className="mt-1 text-[11px] text-ink-dim">Loading…</div>
        </>
      ) : (
        <>
          <div className="mt-2 font-mono text-3xl font-semibold">{river.levelM}m</div>
          <Sparkline points={river.sparkline} />
          <div className="mt-1 text-[11px] text-ink-dim">Last 24 hours</div>
        </>
      )}
    </div>
  );
}
