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
- **Phase 2 — Frontend UI (in progress):**
  - Control Room, Triage Modal, Live Tracker — implemented.
  - **Auth (new):** JWT-based login (`src/lib/auth.js`), route
    protection everywhere except the citizen-facing endpoints, agency
    scoping. Full step-by-step list: `saklolo161-web-phase2-tasks.md`,
    tasks 2.1–2.3.
  - **Shared filter state + Mark En Route (new):** category filter
    lifted out of `ActiveQueue.jsx` into `ControlRoom.jsx`, defaulted
    to the signed-in dispatcher's agency; a real "Mark En Route"
    trigger added to `DispatchTracker.jsx`. Tasks 2.4–2.6 in the same
    file.
  - Station routing uses a local fallback config
    (`src/lib/config.js` → `CATEGORIES[key].stations`) with `id`/`name`
    only — never phone numbers.
- **Phase 3 — Cloud & Integration (next):** Firebase RTDB + Firebase
  Auth + Semaphore SMS. See "Phase 3 migration path" below.

## Design Tokens (must match exactly — `src/index.css` `@theme`)

| Token | Hex | Use |
|---|---|---|
| `--color-header` / Dark Navy | `#111A3A` | header, containers |
| `--color-fire` / Fire Red | `#EF4444` | fire incidents |
| `--color-medical` / Medical Orange | `#F97316` | medical incidents |
| `--color-flood` / Flood Blue | `#3B82F6` | flood/river warnings |
| `--color-crime` / Crime Slate | `#334155` | police/crime incidents |
| `--color-risk-low` / `--color-resolved` / Mint Green | `#10B981` | live badges, resolve buttons — **reserved for the resolved state, don't reuse for other action buttons** |

Tailwind v4: tokens declared in CSS via `@theme`, not
`tailwind.config.js`. `--color-x` auto-generates `bg-x`/`text-x`.

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
5. Code should be React 19 / Express, matching existing patterns — see
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
  exposes `onAuthChange(callback)`, deliberately shaped like Firebase's
  `onAuthStateChanged` even though Phase 2 just reads `localStorage`
  synchronously. `App.jsx` subscribes once; it never calls
  `getStoredAuth()` directly on mount. This is what makes the Phase 3
  Firebase Auth cutover a one-file change — preserve this shape.
- **Single source of truth for categories:** `CATEGORIES`/
  `CATEGORY_KEYS` in `src/lib/config.js` drive color, label, and
  station list everywhere. Don't redeclare category metadata locally.
- **Graceful degradation:** `WeatherCard`, `RiverLevelCard`, and
  `useIncidentPolling` fall back to `src/data/mockIncidents.js` on
  fetch failure (Render free-tier cold starts / local dev without
  backend running). Preserve this in new data-fetching components.

## Local Testing Setup

Pointing `VITE_API_BASE_URL` straight at the live Render URL works for
basic day-to-day frontend work — zero setup, and that's how Phase 1
was meant to be consumed. But for the Phase 2 auth/agency-scoping work
specifically, clone and run `saklolo161-backend` locally instead.
Reasons this matters right now, not just in general:

1. **Unreleased backend work isn't live yet.** `authService.login()`,
   agency-scoped `GET /api/incidents` filtering, and `markEnRoute` all
   land on the backend before they're deployed to Render. There's
   nothing to test 2.1–2.6 against remotely until that happens — local
   backend is the only way to test them early.
2. **Render's free tier cold-starts.** Every dev hitting the same live
   instance after it's idled eats that delay on every request during
   rapid iteration, not just on first load.
3. **Shared, resettable mock data means shared test pollution.**
   `mockIncidents.js`/`mockUsers.js` are one in-memory array on the
   live instance — a dispatched test incident or a newly-provisioned
   test account collides with whatever mobile or another web dev is
   doing the same afternoon, and a Render restart wipes it all at once.
4. **The per-phone rate limiter (once 1.5 ships) is shared** across
   everyone hitting the same live instance.

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

**Specific nuance for this repo:** once backend steps 1.3/1.4 (route
protection) deploy to Render, the live dashboard needs matching web
changes (2.1/2.2) landing in that same window — see the coordination
note in `saklolo161-web-phase2-tasks.md`. Running backend locally in
the meantime is how you test the paired changes together before that
coordinated deploy, without either side being half-broken in
production.

## Known Gaps (do not treat as "done" without flagging)

- `DispatchTracker.jsx`: `STATION_COORDS` is a static demo constant,
  and `Distance`/`ETA` are hardcoded strings, not computed from any
  API response.
- `RouteMap.jsx`: draws a straight line, not a real routed path.
  Intended to be swapped for Mapbox Directions API output (Phase 3+).
- Raw JWT stored in `localStorage` (`src/lib/auth.js`) is a known,
  accepted XSS exposure surface for the Phase 2 staging/testing
  deploy's small trusted user base — not hardened (httpOnly cookie +
  CSRF) yet. Revisit before this is a public-facing production login.

## Phase 3 Migration Path

Net effect: the Phase 3 Firebase migration touches
**`src/lib/auth.js` only** on this repo's side —
`App.jsx`/`Header.jsx`/`api.js`/filter logic never touch Firebase
directly, only `onAuthChange()`'s output shape.

See `saklolo161-auth-implementation-plan-v2.md`'s full cutover
checklist before running that migration — re-provisioning accounts and
the scheduled forced re-login need a coordinated window, not a silent
deploy, and the same is true of the backend's `GET /api/incidents`
route-protection deploy landing in the same window as this repo's
auth work (see the coordination note in
`saklolo161-web-phase2-tasks.md`).

## Mobile App

Not reviewed in this context. See `saklolo161-mobile`'s own
`AGENTS.md`. Do not assume it mirrors any pattern here — it has no
login and calls a deliberately narrower slice of the API
(`POST /api/incidents`, `GET /api/incidents/:id` only).
