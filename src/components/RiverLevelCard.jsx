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
          <div className="mt-1 text-[11px] text-ink-dim">Loading…</div>
        </>
      ) : (
        <div className="mt-2 font-mono text-3xl font-semibold">{river.levelM}m</div>
      )}
    </div>
  );
}
