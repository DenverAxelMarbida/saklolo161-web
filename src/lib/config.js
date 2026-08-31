// Every Vite env var exposed to the browser MUST be prefixed with VITE_ —
// Vite strips everything else out of the bundle for safety, so
// process.env.SOME_SECRET would silently be undefined here.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const MARIKINA_CENTER = { lat: 14.6507, lng: 121.1029 };

// Single source of truth for category → color/label/target-station mapping.
// Every screen (tally grid, markers, filters, station selector) reads from
// this instead of re-declaring its own copy.
export const CATEGORIES = {
  MEDICAL: {
    label: "MEDICAL",
    color: "var(--color-medical)",
    stations: [
      { id: "mdrrmo-main", name: "MDRRMO Main" },
      { id: "armmc", name: "Amang Rodriguez Memorial Medical Center" },
    ],
  },
  FIRE: {
    label: "FIRE",
    color: "var(--color-fire)",
    stations: [
      { id: "bfp-main", name: "BFP Main" },
      { id: "bfp-station-2", name: "BFP Station 2" },
    ],
  },
  FLOOD: {
    label: "FLOOD",
    color: "var(--color-flood)",
    stations: [{ id: "river-command", name: "River Command" }],
  },
  CRIME: {
    label: "CRIME",
    color: "var(--color-crime)",
    stations: [
      { id: "pnp-hq", name: "PNP HQ" },
      { id: "pnp-sub-station", name: "PNP Sub-Station" },
    ],
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
