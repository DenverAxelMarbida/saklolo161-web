# Saklolo 161 — Dispatcher Web Dashboard

React 19 + Vite + Tailwind v4 control room for the **Saklolo 161 Emergency Response System** (Marikina City). Dispatchers triage reports, dispatch stations/units, track incidents live, review evidence, and manage staff accounts against the `saklolo161-backend` API on Render.

## Scripts

```bash
npm run dev      # local dev server (Vite)
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # oxlint
npm test         # vitest run (24-file RTL suite)
```

## Environment (`.env`, `VITE_`-prefixed or stripped from the bundle)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL — Render URL normally, `http://localhost:5000` for local-backend iteration |
| `VITE_MAPBOX_TOKEN` | Mapbox public token for `mapbox-gl` maps |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Firebase client SDK (dispatcher sign-in) |

## Notes for contributors

- Auth is Firebase client SDK behind `src/lib/auth.js`'s subscription shape (`onAuthChange`) — see `AGENTS.md`.
- Category colors are canonical in `src/lib/config.js`, not the CSS tokens.
- User Management UI is admin-role only, end to end.
- See `AGENTS.md` for roadmap context, hard rules, and the staff API table.
