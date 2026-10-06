import { useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";

// Dedicated Settings section — reached via the Header gear button
// (App.jsx view state: "control" | "users" | "settings", no router).
//
// Shows the signed-in account for BOTH roles, reusing the existing
// ChangePasswordModal (no second password-change system). For admins
// only it offers a card that jumps into the EXISTING UserManagement
// view — the component itself is not duplicated here. UI gating only;
// the backend's verifyAuth + requireAdmin on /api/users remains the
// real security boundary.
export default function Settings({ user, onNavigate }) {
  const [showChangePassword, setShowChangePassword] = useState(false);

  const email = user?.email || "";
  const agency = user?.agency || "";
  const role = user?.role || "";
  const isAdmin = role === "admin";

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

        {/* My Account — every signed-in role */}
        <section className="mt-6 rounded-lg border border-border bg-panel p-5">
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
              className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Change Password
            </button>
          </div>
        </section>

        {/* Admin only — dispatcher never renders this card */}
        {isAdmin && (
          <section className="mt-4 rounded-lg border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              User Management
            </h2>
            <p className="mt-2 text-sm text-ink-dim">
              Manage dispatcher and administrator accounts, roles, agencies,
              and account status.
            </p>
            <div className="mt-4">
              <button
                onClick={() => onNavigate("users")}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm transition-colors hover:border-medical/40 hover:text-medical"
              >
                Open User Management
              </button>
            </div>
          </section>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
