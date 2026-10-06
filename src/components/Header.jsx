import { useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";

export default function Header({ dutyOfficer, role, view, onNavigate, onLogout }) {
  // Modal state lives here so every signed-in role (dispatcher AND
  // admin) gets the self-service Change Password control in one place.
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Duty officer is required — the signed-in dispatcher's email (mock
  // users have no display names, so email is the readable identifier).
  const displayName = dutyOfficer || "Dispatcher";
  const initials = displayName
    .split(/[.\s]+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  // UX gating only — the real security boundary is the backend's
  // verifyAuth + requireAdmin (403 for non-admins) on /api/users.
  const isAdmin = role === "admin";

  return (
    <>
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
        <button
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          title="Settings"
          aria-current={view === "settings" ? "page" : undefined}
          className={`rounded-md border px-2 py-1.5 transition-colors ${
            view === "settings"
              ? "border-medical/50 bg-white/10 text-ink"
              : "border-white/10 bg-white/5 text-ink-dim hover:text-ink"
          }`}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {isAdmin &&
          (view === "users" ? (
            <button
              onClick={() => onNavigate("control")}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              Control Room
            </button>
          ) : (
            <button
              onClick={() => onNavigate("users")}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              User Management
            </button>
          ))}
        <button
          onClick={() => setShowChangePassword(true)}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
        >
          Change Password
        </button>
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

    {showChangePassword && (
      <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
    )}
    </>
  );
}
