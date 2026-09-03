export default function Header({ dutyOfficer, onLogout }) {
  // Duty officer is required — the signed-in dispatcher's email (mock
  // users have no display names, so email is the readable identifier).
  const displayName = dutyOfficer || "Dispatcher";
  const initials = displayName
    .split(/[.\s]+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-header px-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold tracking-tight">Marikina City MDRRMO</span>
        <span className="text-ink-dim">/</span>
        <span className="font-mono text-sm text-ink-dim">SAKLOLO 161</span>
      </div>

      <div className="hidden max-w-md flex-1 px-6 md:block">
        <input
          type="search"
          placeholder="Search by ref no., location, or unit…"
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm placeholder:text-ink-dim focus:border-medical focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-medical text-[11px] font-semibold">
            {initials}
          </span>
          <span className="text-sm">{displayName}</span>
          <span className="h-2 w-2 rounded-full bg-risk-low" title="On duty" />
        </div>
        <button
          onClick={onLogout}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:border-fire/40 hover:text-fire"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
