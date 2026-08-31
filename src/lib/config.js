// Every Vite env var exposed to the browser MUST be prefixed with VITE_ —
// Vite strips everything else out of the bundle for safety, so
// process.env.SOME_SECRET would silently be undefined here.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const MARIKINA_CENTER = { lat: 14.6507, lng: 121.1029 };

// Single source of truth for category → color/label/target-station mapping.
// Every screen (tally grid, markers, filters, station selector) reads from
// this instead of re-declaring its own copy.
// Station id/name/assignedUnits mirror backend/config/stations.js exactly.
// The ID is what the backend's stationService resolves by; units must be
// members of that station's assignedUnits array or dispatch validation
// rejects the request.
export const CATEGORIES = {
  MEDICAL: {
    label: "MEDICAL",
    color: "#F97316", // was #2F80ED
    stations: [
      {
        id: "MEDICAL_MDRRMO_BASE",
        name: "MDRRMO Base - Sta. Elena",
        assignedUnits: ["MDRRMO Ambulance 1", "MDRRMO Rescue Van"],
      },
      {
        id: "MEDICAL_ARMMC_ER",
        name: "ARMMC ER Unit - Sumulong",
        assignedUnits: ["ARMMC Ambulance 1"],
      },
    ],
  },
  FIRE: {
    label: "FIRE",
    color: "#EF4444", // was #E4572E
    stations: [
      {
        id: "FIRE_BFP_MAIN_STATION",
        name: "BFP Main Station - Shoe Ave",
        assignedUnits: ["BFP Fire Truck #1", "BFP Rescue Unit"],
      },
      {
        id: "FIRE_BFP_STATION_2",
        name: "BFP Station 2 - Sto. Niño",
        assignedUnits: ["BFP Fire Truck #2"],
      },
    ],
  },
  FLOOD: {
    label: "FLOOD",
    color: "#3B82F6", // was #17A2B8
    stations: [
      {
        id: "FLOOD_RIVER_COMMAND",
        name: "Marikina River Command - Riverbanks Center",
        assignedUnits: ["River Rescue Boat 1", "Flood Response Truck"],
      },
    ],
  },
  CRIME: {
    label: "CRIME",
    color: "#334155", // was #8B5CF6
    stations: [
      {
        id: "CRIME_PNP_MAIN_HQ",
        name: "PNP Main HQ - Sta. Elena",
        assignedUnits: ["PNP Mobile Patrol 1", "PNP Mobile Patrol 2"],
      },
      {
        id: "CRIME_PNP_SUBSTATION",
        name: "PNP Sub-Station - Concepcion Uno",
        assignedUnits: ["PNP Mobile Patrol 3"],
      },
    ],
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
