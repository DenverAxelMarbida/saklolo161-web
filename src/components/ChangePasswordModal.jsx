import { useRef, useState } from "react";
import { changeOwnPassword } from "../lib/api";
import { isStrongPassword } from "../lib/passwordPolicy";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import PasswordRequirements from "./PasswordRequirements";
import PasswordInput from "./PasswordInput";

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || fallback;

// Self-service password change for any signed-in dispatcher or admin
// (backend: POST /api/users/me/password — verifyAuth only; the uid
// comes from the token, never this payload). TriageModal-style
// overlay with a live policy checklist.
export default function ChangePasswordModal({ onClose }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onClose);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const mismatch =
    confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;
  const sameAsCurrent =
    currentPassword.length > 0 && newPassword === currentPassword;

  const canSubmit =
    !saving &&
    currentPassword.length > 0 &&
    isStrongPassword(newPassword) &&
    confirmNewPassword === newPassword &&
    newPassword !== currentPassword;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await changeOwnPassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setSuccess(result?.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't change the password. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Change Password"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Change Password
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="pw-current">
              Current Password
            </label>
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="pw-new">
              New Password
            </label>
            <PasswordInput
              id="pw-new"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
            <PasswordRequirements password={newPassword} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="pw-confirm">
              Confirm New Password
            </label>
            <PasswordInput
              id="pw-confirm"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
            {mismatch && <p className="mt-1 text-xs text-fire">Passwords do not match.</p>}
            {!mismatch && sameAsCurrent && (
              <p className="mt-1 text-xs text-fire">
                New password must be different from the current password.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-fire">{error}</p>}
          {success && <p className="text-sm text-risk-low">{success}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            {saving ? "Changing…" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
