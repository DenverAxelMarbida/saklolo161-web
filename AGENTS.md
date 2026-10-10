# Saklolo161 Web Dashboard — Project Context

Emergency response system for Marikina City, PH ("SAKLOLO 161"). This
file orients any AI coding agent (opencode, Claude Code, etc.) working
in this repo — the dispatcher-facing control room.

## This Repo & Related Repos

| Repo | Stack | Relationship to this repo |
|---|---|---|
| `saklolo161-backend` | Express.js REST API, Render | This repo's only backend. Never write backend/DB code here — see Hard Rules. |
| `saklolo161-mobile` | Expo React Native | Separate, unauthenticated client of the same backend. Don't assume it shares any code with this repo. |

Mapping: pure Mapbox (`mapbox-gl`), free tier. `VITE_MAPBOX_TOKEN`,
`VITE_API_BASE_URL` — any Vite env var exposed to the browser MUST be
prefixed `VITE_` or it's silently stripped from the bundle.

## Roadmap Status

- **Phase 1 — Backend:** done, see `saklolo161-backend`'s `AGENTS.md`.
- **Phase 2 — Frontend UI (done):**
  - Control Room, Triage Modal, Live Tracker — implemented.
  - **Auth:** login (`src/lib/auth.js`), 401-driven sign-out,
    agency scoping (tasks 2.1–2.3).
  - **Shared filter state + Mark En Route:** category filter lifted out
    of `ActiveQueue.jsx` into `ControlRoom.jsx`, defaulted to the
    signed-in dispatcher's agency; a real "Mark En Route" trigger in
    `DispatchTracker.jsx` (tasks 2.4–2.6).
  - Station routing uses a local fallback config
    (`src/lib/config.js` → `CATEGORIES[key].stations`) with `id`/`name`
    only — never phone numbers.
- **Staff User Management (done):** admin-only user table
  (`src/components/UserManagement.jsx`, embedded in the Settings tab),
  Add/Edit modal with password policy, enable/disable with confirm —
  backed by `GET/POST /api/users`, `PATCH /api/users/:uid`,
  `PATCH /api/users/:uid/status`, plus self-service
  `POST /api/users/me/password` (`ChangePasswordModal.jsx`,
  `PasswordInput.jsx`, `PasswordRequirements.jsx`).
- **Control-room polish (done):** visual polish passes, resolved-log
  timestamps, evidence-upload status in the queue, loading/error/auth
  hardening.
- **Phase 3 (done):** real routing/ETA from `GET /api/routes`
  (`RouteMap.jsx`, `DispatchTracker.jsx` with straight-line fallback),
  evidence viewer (`EvidenceGallery.jsx`), a 22-file vitest suite,
  and the Firebase Auth cutover (`src/lib/auth.js` now uses the
  Firebase client SDK — `signInWithEmailAndPassword`,
  `onIdTokenChanged` — with legacy localStorage keys purged).
  - Frozen contract: `saklolo161-phase3-contracts.md`
  - Auth cutover checklist: `saklolo161-auth-coordination.md`
  (historical — the coordinated window has landed).

## Design Tokens

Category colors are canonical in `src/lib/config.js`
(`CATEGORIES[key].color`, applied via inline styles) — do not redeclare
them locally:

| Category | Hex | Use |
|---|---|---|
| Fire Red | `#EF4444` | fire incidents |
| Medical Orange | `#F97316` | medical incidents |
| Flood Blue | `#3B82F6` | flood/river warnings |
| Crime Slate | `#334155` | police/crime incidents |

Chrome/status tokens live in `src/index.css` (`@theme`; `--color-x`
auto-generates `bg-x`/`text-x` — Tailwind v4, no `tailwind.config.js`):

| Token | Hex | Use |
|---|---|---|
| `--color-header` / Dark Navy | `#111A3A` | header, containers |
| `--color-resolved` / `--color-risk-low` / Mint Green | `#10B981` | live badges, resolve buttons — **reserved for the resolved state, don't reuse for other action buttons** |

Note: `index.css` also declares `--color-fire/medical/flood/crime`
tokens with older values (`#e4572e/#2f80ed/#17a2b8/#8b5cf6`) that are
used as generic red/orange action accents (buttons, empty states) —
they are NOT the category palette. If you need a category color, read
`CATEGORIES`, never the CSS token.

## Hard Rules (do not violate)

1. **This repo never writes backend or DB code.** It only consumes
   existing Render endpoints via Axios. If a task needs a new
   endpoint, flag it — don't invent backend logic here.
2. **Never hardcode station duty phone numbers in UI components.**
   Stations are looked up by `stationId`; `src/lib/config.js` only
   stores id + display name.
3. **Live tracking screens poll every 10s via `setInterval`, with
   cleanup on unmount.** Reference implementation:
   `src/hooks/useIncidentPolling.js` — the `isMountedRef` guard against
   `setState` after unmount, and the `refresh()` escape hatch for
   forcing an immediate re-fetch after a mutation (dispatch, resolve,
   mark-en-route) instead of waiting out the interval.
4. **`DispatchTracker.jsx`'s stepper reflects the incident's real
   `status` field — never a locally-guessed or hardcoded step index.**
   This was a real bug (see Known Gaps history) — don't reintroduce it.
5. **User Management is admin-only, end to end.** The Users tab renders
   only for `role === "admin"`, and the backend gates every `/api/users`
   route with `requireAdmin`. Never expose enable/disable or account
   creation to non-admin roles, and never put passwords anywhere but
   the Add modal + change-password flow.
6. Code should be React 19 / Express, matching existing patterns — see
   "Established Patterns" below before introducing a new approach.

## Established Patterns

- **Mapbox lifecycle:** `src/hooks/useMapboxMap.js` centralizes map
  creation/teardown. Any new map-using component calls this hook
  rather than instantiating `mapboxgl.Map` directly.
- **API normalization:** `src/lib/api.js` normalizes backend response
  shapes into the shape the UI expects (`normalizeIncident`). New
  endpoints follow this same normalize-at-the-boundary approach.
- **Generic status updates:** `updateIncidentStatus(incidentId, status)`
  in `src/lib/api.js` wraps the backend's generic status-update
  endpoint; `resolveIncident`/`markEnRoute` are thin wrappers over it.
  Don't add a bespoke API function per status.
- **Auth as a subscription, not a mount check:** `src/lib/auth.js`
  exposes `onAuthChange(callback)`, shaped like Firebase's
  `onAuthStateChanged`; it now runs the real Firebase client SDK
  (`signInWithEmailAndPassword`, `onIdTokenChanged`) with legacy
  localStorage keys purged on load. `App.jsx` subscribes once; it never
  calls `getStoredAuth()` directly on mount. Preserve this shape.
- **User Management without a router:** `UserManagement.jsx` renders
  embedded inside the Settings admin tab (plus a legacy `"users"` view
  that lands there); all account operations go through thin
  `src/lib/api.js` wrappers (`listUsers`/`createUser`/`updateUser`/
  `setUserEnabled`, `changeOwnPassword`). Don't add routing or
  backend logic here.
- **Single source of truth for categories:** `CATEGORIES`/
  `CATEGORY_KEYS` in `src/lib/config.js` drive color, label, and
  station list everywhere. Don't redeclare category metadata locally.
- **Graceful degradation:** `WeatherCard`, `RiverLevelCard`, and
  `useIncidentPolling` fall back to `src/data/mockIncidents.js` on
  fetch failure (Render free-tier cold starts / local dev without
  backend running). Preserve this in new data-fetching components.
  `RouteMap.jsx` likewise draws the straight line only when
  `GET /api/routes` geometry is unavailable.

## Staff Admin API (consumed, never implemented here)

| Call | Endpoint | Notes |
|---|---|---|
| `listUsers` | `GET /api/users` | Admin only |
| `createUser` | `POST /api/users` | Admin only; password set once at creation |
| `updateUser` | `PATCH /api/users/:uid` | Admin only; email / agency / role |
| `setUserEnabled` | `PATCH /api/users/:uid/status` | Admin only; confirm before disabling |
| `changeOwnPassword` | `POST /api/users/me/password` | Any signed-in user; see `ChangePasswordModal.jsx` |

## Local Testing Setup

Pointing `VITE_API_BASE_URL` straight at the live Render URL works for
basic day-to-day frontend work — zero setup. But when iterating fast
or testing auth/agency-scoped behavior, clone and run
`saklolo161-backend` locally instead. Reasons this matters right now,
not just in general:

1. **No shared-quota burn.** The per-phone rate limiter is shared
   across everyone hitting the same live instance — local backend
   gives each dev their own quota.
2. **Render's free tier cold-starts.** Every dev hitting the same live
   instance after it's idled eats that delay on every request during
   rapid iteration, not just on first load.
3. **Shared live data means shared test pollution.**
   Test incidents and provisioned test accounts collide with whatever
   mobile or another web dev is doing the same afternoon.

Setup:

```
git clone <backend-repo-url>
cd saklolo161-backend
npm install
cp .env.example .env    # local-dev fallback values already documented for JWT_SECRET etc. — no real secrets needed
npm run dev              # localhost:5000
```

Point `VITE_API_BASE_URL=http://localhost:5000` in this repo's `.env`.
No write access to the backend repo is needed — clone/pull only, never
push. Running someone else's service locally to test against doesn't
violate Hard Rule 1 ("never write backend code here"); nothing here is
backend code, it's just what this repo's Axios calls point at.

Local runs need real Firebase credentials on the backend side (the
backend server refuses to start without them) — coordinate with the
backend lead rather than inventing stub auth here.

## Known Gaps (do not treat as "done" without flagging)

- No real GPS/telemetry-based "En Route" detection — the dispatcher's
  manual "Mark En Route" action is the trigger; needs a responder
  client to generate telemetry.
- Auth session hardening is still future work: Firebase now owns the
  token model, but revisit httpOnly/CSRF-style hardening before any
  public-facing production login beyond the current trusted dispatcher
  base.

History (resolved, kept so the rules above stay motivated):
`DispatchTracker.jsx` once guessed the stepper index locally instead of
reading `status` — fixed by reflecting the real field (Hard Rule 4).

## Phase 3 Migration Path (completed — reference only)

The Phase 3 Firebase migration touched **`src/lib/auth.js` only** on
this repo's side — `App.jsx`/`Header.jsx`/`api.js`/filter logic never
touch Firebase directly, only `onAuthChange()`'s output shape. That
one-file-swap design held: the cutover landed without touching any
consumer.

See `saklolo161-auth-coordination.md`'s checklist for the historical
record (re-provisioned accounts, forced re-login). Any future auth
migration is a new coordinated window, not a silent deploy.

## Mobile App

Not reviewed in this context. See `saklolo161-mobile`'s own
`AGENTS.md`. Do not assume it mirrors any pattern here — it has no
login and calls a deliberately narrower slice of the API
(`POST /api/incidents`, `GET /api/incidents/:id`, plus the Phase 3
public `GET /api/routes` and `POST /api/incidents/:id/evidence`).
