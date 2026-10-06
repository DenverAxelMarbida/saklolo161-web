import { useCallback, useEffect, useState } from "react";
import { CATEGORY_KEYS } from "../lib/config";
import {
  listUsers,
  createUser,
  updateUser,
  setUserEnabled,
} from "../lib/api";
import { isStrongPassword } from "../lib/passwordPolicy";
import PasswordRequirements from "./PasswordRequirements";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {isAdd ? "Add User" : "Edit User"}
          </h2>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink" aria-label="Close">
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
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              />
              <PasswordRequirements password={form.password} />

              <label className="mt-3 block text-xs uppercase tracking-wide text-ink-dim" htmlFor="user-confirm">
                Confirm Password
              </label>
              <input
                id="user-confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
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
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {saving ? "Saving…" : isAdd ? "Create User" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [bannerError, setBannerError] = useState(null);
  const [modal, setModal] = useState(null); // { mode: "add" } | { mode: "edit", user }
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    agency: AGENCIES[0],
    role: "dispatcher",
  });
  const [modalError, setModalError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDisableUid, setConfirmDisableUid] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(
        errorMessage(err, "Couldn't load users. Check your connection and try again."),
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
    setModal({ mode: "add" });
  };

  const openEdit = (user) => {
    // No password on edit — accounts never expose or reset one here.
    setForm({
      email: user.email,
      password: "",
      confirmPassword: "",
      agency: user.agency,
      role: user.role,
    });
    setModalError(null);
    setModal({ mode: "edit", user });
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
            ? "Couldn't create the user. Try again."
            : "Couldn't save the changes. Try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetEnabled = async (user, enabled) => {
    setBannerError(null);
    try {
      await setUserEnabled(user.uid, enabled);
      setConfirmDisableUid(null);
      await load();
    } catch (err) {
      setConfirmDisableUid(null);
      setBannerError(errorMessage(err, "Couldn't update the user status. Try again."));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">User Management</h1>
            <p className="text-sm text-ink-dim">
              Manage dispatcher and admin accounts for the control room.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add User
          </button>
        </div>

        {bannerError && (
          <p className="mt-4 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire">
            {bannerError}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-center text-sm text-ink-dim">Loading users…</p>
        )}

        {!loading && loadError && (
          <p className="mt-6 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire">
            {loadError}
          </p>
        )}

        {!loading && !loadError && users.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-dim">No users found.</p>
        )}

        {!loading && !loadError && users.length > 0 && (
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
                      {user.disabled ? (
                        <button
                          onClick={() => handleSetEnabled(user, true)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                        >
                          Enable
                        </button>
                      ) : confirmDisableUid === user.uid ? (
                        <>
                          <button
                            onClick={() => handleSetEnabled(user, false)}
                            className="rounded-md border border-fire/40 bg-fire/10 px-2 py-1 text-xs font-semibold text-fire"
                          >
                            Confirm disable
                          </button>
                          <button
                            onClick={() => setConfirmDisableUid(null)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDisableUid(user.uid)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire"
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

      {modal && (
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
    </div>
  );
}
