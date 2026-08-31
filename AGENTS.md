# Saklolo161 — Project Context

Emergency response system for Marikina City, PH ("SAKLOLO 161"). This file
orients any AI coding agent (opencode, Claude Code, etc.) working across
the backend, mobile, and web repos.

## Repos & Stack

| Repo | Stack | Deploy |
|---|---|---|
| `saklolo161-backend` | Express.js REST API | Render (https://saklolo161-backend.onrender.com), no Docker — Render handles PaaS containerization |
| `saklolo161-mobile` | Expo React Native, `@rnmapbox/maps`, Axios | — |
| `saklolo161-web` | React 19 + Vite 8 + Tailwind v4, `mapbox-gl` | Vercel |

Mapping: pure Mapbox on both web and mobile, free tier. Env vars:
`VITE_MAPBOX_TOKEN` (web), `EXPO_PUBLIC_MAPBOX_TOKEN` (mobile). Any Vite
env var exposed to the browser MUST be prefixed `VITE_` or it's silently
stripped from the bundle.

Future (Phase 3): Firebase Realtime Database (asia-southeast1) +
Semaphore SMS API. Not wired up yet — do not assume these exist in code
today.

## Roadmap Status

- **Phase 1 — Backend (done):** Live on Render, ~370 RPS load-tested.
  Confirmed endpoints: `GET /api/weather-river` (10-min cache),
  `GET /api/incidents`, `POST /api/incidents`, `POST /api/incidents/dispatch`.
  **`POST /api/incidents/:id/resolve` is called by the web dashboard but
  is NOT in the confirmed Phase 1 list — verify with backend before
  relying on it.**
- **Phase 2 — Frontend UI (in progress):**
  - Mobile: Home Dashboard, Incident Form, Dispatch Tracker screens.
  - Web: Control Room, Triage Modal, Live Tracker screens — implemented,
    see "Known Gaps" below for what's still placeholder.
  - Station routing uses a local fallback config
    (`src/lib/config.js` → `CATEGORIES[key].stations`) with `id`/`name`
    only — never phone numbers.
- **Phase 3 — Cloud & Integration (next):** Attach
  `FIREBASE_DATABASE_URL`, `FIREBASE_CREDENTIALS`, `SEMAPHORE_API_KEY` to
  Render env; seed `/stations/` in Firebase; e2e test
  Mobile POST → Firebase → Web pin + SMS.

## Design Tokens (must match exactly — defined in `src/index.css` `@theme`)

| Token | Hex | Use |
|---|---|---|
| `--color-header` / Dark Navy | `#111A3A` | header, containers |
| `--color-fire` / Fire Red | `#EF4444` | fire incidents |
| `--color-medical` / Medical Orange | `#F97316` | medical incidents |
| `--color-flood` / Flood Blue | `#3B82F6` | flood/river warnings |
| `--color-crime` / Crime Slate | `#334155` | police/crime incidents |
| `--color-risk-low` / `--color-resolved` / Mint Green | `#10B981` | live badges, resolve buttons |

Tailwind v4: tokens are declared in CSS via `@theme`, not
`tailwind.config.js`. `--color-x` auto-generates `bg-x` / `text-x`
utilities.

## Hard Rules (do not violate)

1. **Frontend (mobile + web) never writes backend or DB code.** It only
   consumes existing Render endpoints via Axios. If a task needs a new
   endpoint, flag it — don't invent backend logic inside a frontend repo.
2. **Never hardcode station duty phone numbers in UI components.**
   Stations are looked up by `stationId` and resolved server-side /
   via Firebase later. `src/lib/config.js` only stores id + display name.
3. **Live tracking screens poll every 10s via `setInterval`, with cleanup
   on unmount.** Reference implementation:
   `src/hooks/useIncidentPolling.js` — note the `isMountedRef` guard
   against `setState` after unmount, and the `refresh()` escape hatch for
   forcing an immediate re-fetch after a mutation (e.g. right after
   dispatch) instead of waiting out the interval.
4. Code should be React 19 / Express, matching existing patterns — see
   "Established Patterns" below before introducing a new approach.

## Established Patterns (web)

- **Mapbox lifecycle:** `src/hooks/useMapboxMap.js` centralizes map
  creation/teardown (guards against React 18 StrictMode's double-effect
  in dev, cleans up the WebGL context on unmount). Any new map-using
  component should call this hook rather than instantiating
  `mapboxgl.Map` directly.
- **API normalization:** `src/lib/api.js` normalizes backend response
  shapes (varying field casing) into the shape the UI expects (see
  `normalizeIncident`). New endpoints should follow this same
  normalize-at-the-boundary approach rather than letting raw backend
  shapes leak into components.
- **Graceful degradation:** `WeatherCard`, `RiverLevelCard`, and
  `useIncidentPolling` fall back to `src/data/mockIncidents.js` on fetch
  failure (Render free-tier cold starts / local dev without backend
  running). Preserve this pattern in new data-fetching components.
- **Single source of truth for categories:** `CATEGORIES` /
  `CATEGORY_KEYS` in `src/lib/config.js` drive color, label, and station
  list everywhere (tally, markers, filters, station selector). Don't
  redeclare category metadata locally in a component.

## Known Gaps (do not treat as "done" without flagging)

- `DispatchTracker.jsx`: `STATION_COORDS` is a static demo constant, and
  `Distance`/`ETA` in the UI are hardcoded strings, not computed from any
  API response. Real values should come from the station record + a
  routing service.
- `RouteMap.jsx`: draws a straight line between station and incident, not
  a real routed path. Intended to be swapped for Mapbox Directions API
  output once available (Phase 3-ish).
- `resolveIncident()` in `src/lib/api.js` calls `PATCH
  /api/incidents/:id/status` with body `{ status: "Resolved" }`, which
  matches the backend's registered route (`routes/incidentRoutes.js`,
  `PATCH /:id/status`) — confirmed working as of this verification.
- `DispatchTracker.handleResolve` marks the local state resolved even if
  the network call throws (intentional UX choice, but means UI-only
  testing won't catch a broken `/resolve` endpoint).

## Mobile App

Not yet reviewed in this context — if working across both web and
mobile, request the mobile repo's file contents before making
cross-repo assumptions about shared logic (e.g. don't assume mobile
mirrors `src/lib/api.js` exactly).