import { useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import UserManagement from "./UserManagement";
import Policies from "./Policies";

// Dedicated Settings section — reached via the Header gear button
// (App.jsx view state: "control" | "users" | "settings", no router).
//
// Tabbed for every role: "My Account" (all roles, reuses the existing
// ChangePasswordModal — no second password-change system), "User
// Management" (admins only, renders the EXISTING UserManagement
// component inline — no redirect to a separate top-level view), and
// "Policies" (all roles: Acceptable Use, Data Privacy & Security,
// RBAC information). UI gating only; the backend's verifyAuth +
// requireAdmin on /api/users remains the real security boundary.
// initialSection="users" is App's compatibility entry for the legacy
// "users" view.
export default function Settings({ user, onNavigate, initialSection }) {
  const [showChangePassword, setShowChangePassword] = useState(false);

  const email = user?.email || "";
  const agency = user?.agency || "";
  const role = user?.role || "";
  const isAdmin = role === "admin";
  const [section, setSection] = useState(
    isAdmin && initialSection === "users" ? "users" : "account",
  );

  // Tabs every role sees; admins additionally get User Management.
  // The Policies tab is informational — readable by dispatchers and
  // admins alike, since it describes rules rather than granting access.
  const tabs = isAdmin
    ? [
        { id: "account", label: "My Account" },
        { id: "users", label: "User Management" },
        { id: "policies", label: "Policies" },
      ]
    : [
        { id: "account", label: "My Account" },
        { id: "policies", label: "Policies" },
      ];

  const panelProps = (id) => ({
    role: "tabpanel",
    id: `settings-panel-${id}`,
    "aria-labelledby": `settings-tab-${id}`,
  });

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

        {/* Tabs for every role — User Management only renders for admins */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mt-5 flex gap-1 border-b border-border"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={section === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => setSection(tab.id)}
              className={tabClass(section === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {section === "account" && (
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
        )}
        {section === "users" && isAdmin && (
          /* Admin only — the EXISTING UserManagement component, inline */
          <div {...panelProps("users")} className="mt-6">
            <UserManagement embedded />
          </div>
        )}
        {section === "policies" && (
          /* Every role — policy information, no privileged actions */
          <div {...panelProps("policies")}>
            <Policies />
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
