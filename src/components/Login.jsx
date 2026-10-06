import { useState } from "react";
import { login } from "../lib/auth";
import logoUrl from "../../icon.png";
import PasswordInput from "./PasswordInput";

// Dispatcher sign-in. Two cells on one grid: the Saklolo 161 identity
// (real app mark + wordmark) and the access card, so the first screen
// reads as a command-center entry point rather than a generic form.
// Layout reflows to a single centered column below lg — one DOM instance
// of the brand block, so there is exactly one <h1> at every width.
//
// Auth behavior is untouched: login() still reports failures as
// axios-shaped errors ({ response: { data: { message } } }) and still
// notifies onAuthChange on success, which is what swaps App to the
// dashboard. Nothing about credentials or Firebase is surfaced here.
export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [signedIn, setSignedIn] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await login(email, password);
      // On success, login() has already notified subscribers, so App.jsx
      // re-renders the dashboard out from under us. onSuccess is purely
      // cosmetic here (optional "Signed in" toast).
      setSignedIn(true);
      onSuccess?.();
    } catch (err) {
      const payload = err?.response?.data;
      setErrorMsg(
        payload?.message || "Couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sak-login-grid animate-screen-in relative flex min-h-screen items-center justify-center bg-bg p-4 sm:p-6 lg:p-10">
      {/* Single hairline accent across the top edge — the only gradient in
          the composition, kept to a rule so it frames instead of decorates. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-medical/70 to-transparent"
      />

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* Identity cell */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="rounded-2xl border border-border bg-panel p-3 shadow-2xl ring-1 ring-white/5">
            <img
              src={logoUrl}
              alt=""
              width="96"
              height="96"
              className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-medical">
            Marikina City MDRRMO
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            SAKLOLO 161
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
            Emergency response control room — incident triage, live dispatch
            tracking, and river and weather monitoring for Marikina City.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-ink-dim">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-risk-low" />
              On-duty access
            </span>
            <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-ink-dim">
              MDRRMO personnel only
            </span>
          </div>
        </div>

        {/* Access cell */}
        <div className="w-full max-w-md justify-self-center rounded-xl border border-border bg-panel p-6 shadow-2xl sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-dim">
            Control room sign-in
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
            Dispatcher Login
          </h2>

          {signedIn && (
            <p className="mt-4 rounded-md border border-risk-low/40 bg-risk-low/15 px-3 py-2 text-center text-sm text-risk-low">
              Signed in
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
                placeholder="you@marikina.gov.ph"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="password">
                Password
              </label>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg pl-3 py-2 text-sm focus:border-medical focus:outline-none"
                placeholder="Password"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm text-fire">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-medical py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-5 border-t border-border pt-4 text-[11px] text-ink-dim">
            For Marikina City MDRRMO operations personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
