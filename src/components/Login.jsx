import { useState } from "react";
import { login } from "../lib/auth";

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
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-sm rounded-lg border border-border bg-panel p-6">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight">SAKLOLO 161</h1>
          <p className="mt-1 text-sm text-ink-dim">Dispatcher Login</p>
        </div>

        {signedIn && (
          <p className="mb-4 rounded-md border border-risk-low/40 bg-risk-low/15 px-3 py-2 text-center text-sm text-risk-low">
            Signed in
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
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
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              placeholder="Password"
            />
          </div>

          {errorMsg && <p className="text-sm text-fire">{errorMsg}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-medical py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
