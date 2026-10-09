import { useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import UserManagement from "./UserManagement";

// Dedicated Settings section — reached via the Header gear button
// (App.jsx view state: "control" | "users" | "settings", no router).
//
// One section, tabbed: "My Account" for BOTH roles reuses the existing
// ChangePasswordModal (no second password-change system); admins also
// get a "User Management" tab that renders the EXISTING UserManagement
// component inline — no redirect to a separate top-level view. UI
// gating only; the backend's verifyAuth + requireAdmin on /api/users
// remains the real security boundary. initialSection="users" is App's
// compatibility entry for the legacy "users" view.
export default function Settings({ user, onNavigate, initialSection }) {
  const [showChangePassword, setShowChangePassword] = useState(false);

  const email = user?.email || "";
  const agency = user?.agency || "";
  const role = user?.role || "";
  const isAdmin = role === "admin";
  const [section, setSection] = useState(
    isAdmin && initialSection === "users" ? "users" : "account",
  );

  // Dispatcher: no tabs at all — the My Account content stands alone
  // exactly as before, with no tabpanel roles pointing at tabs that
  // don't exist.
  const panelProps = (id) =>
    isAdmin
      ? {
          role: "tabpanel",
          id: `settings-panel-${id}`,
          "aria-labelledby": `settings-tab-${id}`,
        }
      : {};

  const tabClass = (active) =>
    `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
      active
        ? "border-medical font-semibold text-ink"
        : "border-transparent text-ink-dim hover:text-ink"
    }`;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-ink-dim">
              Manage your account and control-room access.
            </p>
          </div>
          <button
            onClick={() => onNavigate("control")}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
          >
            Back to Control Room
          </button>
        </div>

        {/* Admin only — dispatchers never render this tab bar */}
        {isAdmin && (
          <div
            role="tablist"
            aria-label="Settings sections"
            className="mt-5 flex gap-1 border-b border-border"
          >
            <button
              type="button"
              role="tab"
              id="settings-tab-account"
              aria-selected={section === "account"}
              aria-controls="settings-panel-account"
              onClick={() => setSection("account")}
              className={tabClass(section === "account")}
            >
              My Account
            </button>
            <button
              type="button"
              role="tab"
              id="settings-tab-users"
              aria-selected={section === "users"}
              aria-controls="settings-panel-users"
              onClick={() => setSection("users")}
              className={tabClass(section === "users")}
            >
              User Management
            </button>
          </div>
        )}

        {section === "account" ? (
          /* My Account — every signed-in role */
          <section
            {...panelProps("account")}
            className="mt-6 rounded-lg border border-border bg-panel p-5"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              My Account
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-dim">
                  Email
                </dt>
                <dd className="mt-1 text-sm break-all">{email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-dim">
                  Agency
                </dt>
                <dd className="mt-1 text-sm">{agency || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-dim">
                  Role
                </dt>
                <dd className="mt-1 text-sm">{role || "—"}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <button
                onClick={() => setShowChangePassword(true)}
                className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                Change Password
              </button>
            </div>
          </section>
        ) : (
          /* Admin only — the EXISTING UserManagement component, inline */
          <div {...panelProps("users")} className="mt-6">
            <UserManagement embedded />
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
