// Internal policy/information area, rendered inside Settings for every
// signed-in role. Content rules for this file:
// - Describe only roles, permissions, security controls, and behavior
//   verified in the code (see comments). Backend authorization
//   (verifyAuth + requireAdmin + agency scoping) is the real
//   enforcement boundary; UI gating here is cosmetic.
// - Anything operational the code cannot answer (retention periods,
//   deletion process, privacy contact) is marked PENDING AGENCY REVIEW.
// - Refer to RA 10173 (Philippine Data Privacy Act of 2012) for review
//   without claiming certified compliance.
// - This is a DRAFT until reviewed by the responsible Marikina City
//   office, privacy officer/DPO, and legal adviser.
export default function Policies() {
  return (
    <div className="mt-6 space-y-6">
      <div
        data-testid="policies-draft-notice"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
      >
        <h2 className="text-sm font-bold text-amber-200">Draft notice</h2>
        <p className="mt-1 text-xs leading-5 text-amber-100/90">
          These policies are drafts pending review by the responsible
          Marikina City office, the privacy officer/DPO, and a legal
          adviser, with reference to the Philippine Data Privacy Act of
          2012 (RA 10173). They do not claim certified compliance.
        </p>
      </div>

      <section
        aria-labelledby="policies-aup"
        className="rounded-lg border border-border bg-panel p-5"
      >
        <h2
          id="policies-aup"
          data-testid="policies-aup-heading"
          className="text-sm font-semibold uppercase tracking-wide"
        >
          Acceptable Use Policy
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-ink-dim">
          <p>
            This dashboard is for authorized Marikina City emergency
            response staff only. Use your account solely for your
            assigned dispatch duties: triaging reports, dispatching
            stations and units, updating incident statuses, reviewing
            evidence, and — for admins — managing staff accounts.
          </p>
          <p>
            Do not share your login, access incidents outside your
            agency&apos;s scope, or use report data (including reporter
            contact numbers shown during triage) for any purpose other
            than emergency response. The system technically limits each
            account to its own agency&apos;s incidents; misuse beyond
            that is a personnel matter pending agency review.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="policies-privacy"
        className="rounded-lg border border-border bg-panel p-5"
      >
        <h2
          id="policies-privacy"
          data-testid="policies-privacy-heading"
          className="text-sm font-semibold uppercase tracking-wide"
        >
          Data Privacy and Security
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-ink-dim">
          <p>
            Sign-in uses Firebase Authentication: sessions carry Firebase
            ID tokens sent as Bearer tokens, refreshed automatically,
            and legacy local tokens are purged from this browser on
            load. Passwords are entered only in the account-creation
            dialog and the change-password flow — never displayed back.
          </p>
          <p>
            Incident reports (reporter number, location, notes, photos
            and videos) are stored in the project&apos;s Firebase
            database and file storage; attached media is served by
            download URL. Reporters get two text messages per incident
            — a confirmation at submission and a resolution notice —
            sent only to the number on their report; dispatch and
            intermediate statuses send no texts.
          </p>
          <p>
            Server logs record request method, path, status, and timing
            — never phone numbers, message contents, or tokens. Backend
            permission checks (login verification, admin role, agency
            scope) run on every request; what this dashboard hides or
            shows by role is convenience, not protection.
          </p>
          <p data-testid="policies-retention-pending">
            How long incident data is kept, how deletion requests are
            handled, and the privacy contact channel are pending agency
            review: the service currently provides no retention schedule
            or deletion control. They will be stated here once the
            responsible office decides them.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="policies-rbac"
        className="rounded-lg border border-border bg-panel p-5"
      >
        <h2
          id="policies-rbac"
          data-testid="policies-rbac-heading"
          className="text-sm font-semibold uppercase tracking-wide"
        >
          Role-Based Access Control
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-ink-dim">
          <p>
            Every account carries an agency and a role —{" "}
            <code className="text-ink">admin</code> or{" "}
            <code className="text-ink">dispatcher</code> — assigned by an
            admin and stored with the Firebase account. These are the
            only two roles; no other role exists.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Dispatchers see and dispatch only their own agency&apos;s
              incidents; anything else is rejected by the backend.
            </li>
            <li>
              Admins additionally see all agencies and manage staff
              accounts (create, edit, enable/disable) in the User
              Management tab.
            </li>
            <li>
              Any signed-in user may change their own password from My
              Account.
            </li>
          </ul>
          <p>
            Screens hide what a role may not use, but the backend
            re-checks the role and agency on each request — a hidden
            button is never the actual protection.
          </p>
        </div>
      </section>
    </div>
  );
}
