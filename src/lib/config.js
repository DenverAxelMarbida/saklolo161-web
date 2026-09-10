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
        name: "Marikina City Disaster Risk Reduction Management Office",
        assignedUnits: ["Rescue 161 Ambulance #1", "Ambulance #2", "Heavy Rescue Truck #1"],
      },
      {
        id: "MEDICAL_ARMMC_ER",
        name: "Amang Rodriguez Memorial Medical Center",
        assignedUnits: ["ARMMC ALS Ambulance #1", "Mobile Trauma Unit"],
      },
    ],
  },
  FIRE: {
    label: "FIRE",
    color: "#EF4444", // was #E4572E
    stations: [
      {
        id: "FIRE_BFP_MAIN_STATION",
        name: "Bureau of Fire Protection Central Fire Station - Marikina City",
        assignedUnits: ["BFP Engine Pumper #1", "BFP Engine Pumper #2", "BFP Rescue Unit"],
      },
      {
        id: "FIRE_BFP_STATION_2",
        name: "Barangay Emergency Response Team - BERT",
        assignedUnits: ["BFP Engine Pumper #3", "BFP Tanker #1"],
      },
    ],
  },
  FLOOD: {
    label: "FLOOD",
    color: "#3B82F6", // was #17A2B8
    stations: [
      {
        id: "FLOOD_RIVER_COMMAND",
        name: "River Park Authority",
        assignedUnits: ["Rescue Boat Unit #1", "Rescue Boat Unit #2", "Amphibious Truck #1"],
      },
    ],
  },
  CRIME: {
    label: "CRIME",
    color: "#334155", // was #8B5CF6
    stations: [
      {
        id: "CRIME_PNP_MAIN_HQ",
        name: "Marikina City Police Headquarters",
        assignedUnits: ["Mobile Patrol #101", "Mobile Patrol #102", "SWAT Van #1"],
      },
      {
        id: "CRIME_PNP_SUBSTATION",
        name: "Barangka Police Sub-Station Marikina City",
        assignedUnits: ["Mobile Patrol #103", "Mobile Patrol #104", "Mobile Patrol #105"],
      },
    ],
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
