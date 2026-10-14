import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORY_KEYS } from "../lib/config";
import {
  listUsers,
  createUser,
  updateUser,
  setUserEnabled,
  adminSetUserPassword,
} from "../lib/api";
import { isStrongPassword } from "../lib/passwordPolicy";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import AdminPasswordModal from "./AdminPasswordModal";
import PasswordRequirements from "./PasswordRequirements";
import PasswordInput from "./PasswordInput";
import Skeleton from "./Skeleton";

// Agencies come from the config source of truth (single source of
// truth for categories), plus ALL for the cross-agency admin seat.
const AGENCIES = [...CATEGORY_KEYS, "ALL"];
const ROLES = [
  { value: "dispatcher", label: "Dispatcher" },
  { value: "admin", label: "Admin" },
];

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || fallback;

// TriageModal-style overlay form for add/edit. Password exists for
// ADD ONLY — editing an account never touches a password. The add
// mode enforces the shared password policy (live checklist) plus a
// confirm field; the backend re-validates everything server-side.
function UserFormModal({ mode, form, setForm, error, saving, onCancel, onSubmit }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);
  const isAdd = mode === "add";
  const confirmMismatch =
    isAdd && form.confirmPassword.length > 0 && form.confirmPassword !== form.password;
  const addValid =
    isAdd &&
    form.password.length > 0 &&
    isStrongPassword(form.password) &&
    form.confirmPassword === form.password;
  const canSubmit = !saving && (!isAdd || addValid);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={isAdd ? "Add Account" : "Edit Account"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {isAdd ? "Add Account" : "Edit Account"}
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
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          {isAdd && (
            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-password">
                Password
              </label>
              <PasswordInput
                id="user-password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
              />
              <PasswordRequirements password={form.password} />

              <label className="mt-3 block text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-confirm">
                Confirm Password
              </label>
              <PasswordInput
                id="user-confirm"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
              />
              {confirmMismatch && (
                <p className="mt-1 text-xs text-fire">Passwords do not match.</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-agency">
              Agency
            </label>
            <select
              id="user-agency"
              value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            >
              {AGENCIES.map((agency) => (
                <option key={agency} value={agency}>
                  {agency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-fire">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            {saving ? "Saving…" : isAdd ? "Create Account" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Confirmation dialog for disabling an account. Disabling revokes
// the target's access, so the ADMIN must re-prove their OWN current
// password here — the backend (PATCH /api/users/:uid/status) re-
// verifies it server-side against the authenticated token's email
// before anything is disabled. Thin wrapper over the shared
// AdminPasswordModal (same UI + wording as before the extraction).
function DisableAccountModal({ user, saving, error, onCancel, onSubmit }) {
  return (
    <AdminPasswordModal
      ariaLabel="Disable Account"
      title="Disable Account"
      description={
        <p className="text-sm">
          Disable <span className="font-semibold">{user.email}</span>? The
          account can no longer sign in until it is enabled again.
        </p>
      }
      confirmLabel="Confirm Disable"
      savingLabel="Disabling…"
      saving={saving}
      error={error}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

// Admin reset of ANOTHER account's password (backend:
// PATCH /api/users/:uid/password — verifyAuth + requireAdmin). The
// new password and its confirmation are collected first; saving then
// opens the shared AdminPasswordModal so the ADMIN re-proves their
// OWN current password — the backend re-verifies it server-side
// against the token's email before the change is applied. Mirrors
// the self-service ChangePasswordModal UX (live policy checklist,
// success message in-dialog, fields cleared on success). Canceling
// the verification step never calls the API.
function AdminSetPasswordModal({ user, onCancel }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const mismatch =
    confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;
  const canSubmit =
    !saving &&
    isStrongPassword(newPassword) &&
    confirmNewPassword === newPassword;

  const handleVerify = async (adminPassword) => {
    setSaving(true);
    setVerifyError(null);
    try {
      const result = await adminSetUserPassword(user.uid, {
        newPassword,
        confirmNewPassword,
        adminPassword,
      });
      setSuccess(result?.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmNewPassword("");
      setVerifying(false);
    } catch (err) {
      // Wrong admin password / backend failure: stay on the
      // verification dialog so it can be corrected without
      // re-entering the new password. Neither password is ever
      // persisted beyond this request.
      setVerifyError(
        errorMessage(err, "Couldn't update the password. Try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (verifying) {
    return (
      <AdminPasswordModal
        ariaLabel="Verify Admin Password"
        title="Confirm Password Change"
        description={
          <p className="text-sm">
            Set a new password for{" "}
            <span className="font-semibold">{user.email}</span>.
          </p>
        }
        confirmLabel="Update Password"
        savingLabel="Updating…"
        saving={saving}
        error={verifyError}
        onCancel={() => {
          setVerifying(false);
          setVerifyError(null);
        }}
        onSubmit={handleVerify}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Change Account Password"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Change Account Password
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
          <p className="text-sm">
            Set a new password for{" "}
            <span className="font-semibold">{user.email}</span>.
          </p>
          <div>
            <label
              className="text-xs uppercase tracking-wide text-ink-dim"
              htmlFor="admin-reset-new"
            >
              New Password
            </label>
            <PasswordInput
              id="admin-reset-new"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
            <PasswordRequirements password={newPassword} />
          </div>

          <div>
            <label
              className="text-xs uppercase tracking-wide text-ink-dim"
              htmlFor="admin-reset-confirm"
            >
              Confirm New Password
            </label>
            <PasswordInput
              id="admin-reset-confirm"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
            {mismatch && (
              <p className="mt-1 text-xs text-fire">Passwords do not match.</p>
            )}
          </div>

          {success && <p className="text-sm text-risk-low">{success}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            {success ? "Close" : "Cancel"}
          </button>
          <button
            onClick={() => {
              if (!canSubmit) return;
              setSuccess(null);
              setVerifyError(null);
              setVerifying(true);
            }}
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

// standalone (default) it owns its full-page scroll wrapper; embedded
// inside Settings it renders just its content, letting the Settings
// section own the scroll/padding instead of nesting two scroll areas.
export default function UserManagement({ embedded = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [bannerError, setBannerError] = useState(null);
  const [bannerSuccess, setBannerSuccess] = useState(null);
  // { mode: "add" } | { mode: "edit", user } | { mode: "disable", user }
  const [modal, setModal] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null); // user for AdminSetPasswordModal
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    agency: AGENCIES[0],
    role: "dispatcher",
  });
  const [modalError, setModalError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingToggleUid, setPendingToggleUid] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(
        errorMessage(err, "Couldn't load accounts. Check your connection and try again."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({
      email: "",
      password: "",
      confirmPassword: "",
      agency: AGENCIES[0],
      role: "dispatcher",
    });
    setModalError(null);
    setBannerSuccess(null);
    setModal({ mode: "add" });
  };

  const openEdit = (user) => {
    // No password on edit — accounts never expose or reset one here.
    // Password resets go through the dedicated Change Password action.
    setForm({
      email: user.email,
      password: "",
      confirmPassword: "",
      agency: user.agency,
      role: user.role,
    });
    setModalError(null);
    setBannerSuccess(null);
    setModal({ mode: "edit", user });
  };

  const openDisable = (user) => {
    setModalError(null);
    setBannerSuccess(null);
    setModal({ mode: "disable", user });
  };

  const openPasswordReset = (user) => {
    setBannerSuccess(null);
    setPasswordTarget(user);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalError(null);
    try {
      if (modal.mode === "add") {
        await createUser({
          email: form.email.trim(),
          password: form.password,
          agency: form.agency,
          role: form.role,
        });
        setBannerSuccess("Account created.");
      } else {
        await updateUser(modal.user.uid, {
          email: form.email.trim(),
          agency: form.agency,
          role: form.role,
        });
      }
      setModal(null);
      await load();
    } catch (err) {
      setModalError(
        errorMessage(
          err,
          modal.mode === "add"
            ? "Couldn't create the account. Try again."
            : "Couldn't save the changes. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetEnabled = async (user, enabled, adminPassword) => {
    // One toggle at a time: a disabled double-click must never fire a
    // second PATCH for the same (or another) row.
    if (pendingToggleUid != null) return;
    setPendingToggleUid(user.uid);
    setBannerError(null);
    setBannerSuccess(null);
    setModalError(null);
    try {
      const result = adminPassword
        ? await setUserEnabled(user.uid, enabled, { adminPassword })
        : await setUserEnabled(user.uid, enabled);
      setModal(null);
      setBannerSuccess(result?.message || (enabled ? "User enabled." : "User disabled."));
      await load();
    } catch (err) {
      const message = errorMessage(
        err,
        "Couldn't update the account status. Try again.",
      );
      if (enabled) {
        // Enable runs from the row — surface the failure as a page banner.
        setBannerError(message);
      } else {
        // Disable runs from the dialog — keep it open so a wrong
        // password can be corrected without re-opening it.
        setModalError(message);
      }
    } finally {
      setPendingToggleUid(null);
    }
  };

  // Embedded: Settings already provides the scroll container and the
  // max-w wrapper — skip both so padding/scrollbars don't double up.
  const Heading = embedded ? "h2" : "h1";

  return (
    <div className={embedded ? "" : "h-full overflow-y-auto p-6"}>
      <div className={embedded ? "" : "mx-auto w-full max-w-4xl"}>
        <div className="flex items-center justify-between">
          <div>
            <Heading className="text-lg font-semibold">Account Management</Heading>
            <p className="text-sm text-ink-dim">
              Manage dispatcher and admin accounts for the control room.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            Add Account
          </button>
        </div>

        {bannerSuccess && (
          <p className="mt-4 rounded border border-risk-low/40 bg-risk-low/10 p-3 text-sm text-risk-low">
            {bannerSuccess}
          </p>
        )}

        {bannerError && (
          <p className="mt-4 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire">
            {bannerError}
          </p>
        )}

        {/* Initial load only (no rows yet) gets the skeleton; a
            background refetch after a mutation keeps the rows up. */}
        {loading && users.length === 0 && (
          <div
            role="status"
            aria-label="Loading accounts"
            className="mt-6 space-y-2"
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border bg-panel p-3"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Failure keeps any stale rows visible alongside the error —
            never swap a populated list for an empty-looking one.
            role="alert" announces the failure; Retry re-runs load().
            load() clears the error while it runs, so a second click
            can never stack a request: the button can't exist mid-load. */}
        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="ml-2 rounded border border-fire/50 px-2 py-0.5 font-semibold hover:bg-fire/20 disabled:opacity-60"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && users.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-dim">No accounts found.</p>
        )}

        {users.length > 0 && (
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-dim">
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Agency</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} className="border-b border-border">
                  <td className="py-2.5 pr-3">{user.email}</td>
                  <td className="py-2.5 pr-3">{user.agency}</td>
                  <td className="py-2.5 pr-3">{user.role}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        user.disabled
                          ? "border-fire/40 bg-fire/10 text-fire"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      {user.disabled ? "Disabled" : "Enabled"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openPasswordReset(user)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                      >
                        Change Password
                      </button>
                      {user.disabled ? (
                        <button
                          onClick={() => handleSetEnabled(user, true)}
                          disabled={pendingToggleUid != null}
                          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                        >
                          Enable
                        </button>
                      ) : (
                        <button
                          onClick={() => openDisable(user)}
                          disabled={pendingToggleUid != null}
                          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire disabled:opacity-60"
                        >
                          Disable
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && modal.mode !== "disable" && (
        <UserFormModal
          mode={modal.mode}
          form={form}
          setForm={setForm}
          error={modalError}
          saving={saving}
          onCancel={() => setModal(null)}
          onSubmit={handleSave}
        />
      )}

      {modal && modal.mode === "disable" && (
        <DisableAccountModal
          user={modal.user}
          saving={saving || pendingToggleUid != null}
          error={modalError}
          onCancel={() => setModal(null)}
          onSubmit={(adminPassword) =>
            handleSetEnabled(modal.user, false, adminPassword)
          }
        />
      )}

      {passwordTarget && (
        <AdminSetPasswordModal
          user={passwordTarget}
          onCancel={() => setPasswordTarget(null)}
        />
      )}
    </div>
  );
}
