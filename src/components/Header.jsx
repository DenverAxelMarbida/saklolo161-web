import { useRef, useState } from "react";
import ConfirmModal from "./ConfirmModal";

// Header chrome for the signed-in control room.
//
// Deliberately minimal: brand, the Settings gear, the duty-officer chip,
// and a danger-styled Logout — no search field (it was dead UI: an input
// with no handler behind it) and no Change Password / User Management
// entries; those live behind the Settings view (which is also the way
// back out of User Management), so this bar never grows past one
// navigation control and one session control. Role doesn't change what's
// rendered, so it isn't taken as a prop. (The backend's verifyAuth +
// requireAdmin remain the real security boundary; this is presentation
// only.)
export default function Header({ dutyOfficer, view, onNavigate, onLogout }) {
  // Logout is destructive, so it confirms first — the modal calls
  // onLogout (which reaches App's logout()) only on explicit confirm.
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const logoutButtonRef = useRef(null);

  // Duty officer is required — the signed-in dispatcher's email (mock
  // users have no display names, so email is the readable identifier).
  const displayName = dutyOfficer || "Dispatcher";
  const initials = displayName
    .split(/[.\s]+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  // The legacy "users" entry lands inside Settings (User Management is
  // a Settings tab now), so both views mark the gear as current.
  const onSettingsSection = view === "settings" || view === "users";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-header px-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">Saklolo 161</span>
          <span className="text-ink-dim" aria-hidden="true">
            –
          </span>
          <span className="text-sm text-ink-dim">Marikina City DRRMO</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("settings")}
            aria-label="Settings"
            title="Settings"
            aria-current={onSettingsSection ? "page" : undefined}
            className={`rounded-md border px-2 py-1.5 transition-colors ${
              onSettingsSection
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
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-medical text-[11px] font-semibold">
              {initials}
            </span>
            <span className="hidden text-sm md:inline">{displayName}</span>
            <span className="h-2 w-2 rounded-full bg-risk-low" title="On duty" />
          </div>
          {/* Solid fire red with dark navy ink clears 4.5:1 on this header
              (unlike fire text on a red-tinted surface, which lands ~4:1).
              Red-on-navy reads as a deliberate session control rather than
              a stray bright CTA. */}
          <button
            ref={logoutButtonRef}
            onClick={() => setConfirmingLogout(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-fire px-2.5 py-1.5 text-xs font-semibold text-header transition-opacity hover:opacity-90 active:opacity-80"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v10" />
              <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {confirmingLogout && (
        <ConfirmModal
          title="Log out?"
          message="You'll leave the control room and need to sign in again to continue working."
          cancelLabel="Cancel"
          confirmLabel="Log Out"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => {
            setConfirmingLogout(false);
            onLogout();
          }}
          returnFocusRef={logoutButtonRef}
        />
      )}
    </>
  );
}
