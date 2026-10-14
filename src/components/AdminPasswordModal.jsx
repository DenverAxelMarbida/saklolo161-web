import { useRef, useState } from "react";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import { focusRing } from "./adminShared";
import PasswordInput from "./PasswordInput";

// Shared reauthentication dialog for SENSITIVE admin actions
// (disable account, change another account's password, edit a
// station, deactivate a station). It asks for the ADMIN'S OWN current
// password — never the target's — and hands it to onSubmit, which
// sends it to the backend inside the action request. The backend
// (verifyAdminReauth) re-verifies it server-side against the
// authenticated token's email before anything changes; this dialog
// is UI only and can never bypass that check. The password lives
// only in this component's state for the life of the dialog — it is
// never persisted, logged, or put in a URL.
//
// Extracted from UserManagement's DisableAccountModal so every
// password-protected action shares one verification pattern instead
// of duplicating it (labels and button texts stay configurable so
// each flow keeps its own wording).
export default function AdminPasswordModal({
  ariaLabel,
  title,
  description,
  confirmLabel,
  savingLabel,
  tone = "danger",
  saving = false,
  error = null,
  onCancel,
  onSubmit,
}) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);
  const [adminPassword, setAdminPassword] = useState("");
  const canSubmit = !saving && adminPassword.length > 0;

  const confirmClassName =
    tone === "primary"
      ? `flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60 ${focusRing}`
      : `flex-1 rounded-md border border-fire/40 bg-fire/10 py-2 text-sm font-semibold text-fire transition-opacity disabled:opacity-60 ${focusRing}`;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          {description}
          <p className="text-sm text-ink-dim">
            For your security, enter your own current password to confirm.
          </p>
          <div>
            <label
              className="text-xs uppercase tracking-wide text-ink-dim"
              htmlFor="admin-password"
            >
              Your Current Password
            </label>
            <PasswordInput
              id="admin-password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          {error && <p role="alert" className="text-sm text-fire">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onCancel}
            className={`flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink ${focusRing}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(adminPassword)}
            disabled={!canSubmit}
            className={confirmClassName}
          >
            {saving ? savingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
