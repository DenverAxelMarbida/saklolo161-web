export const mockWeatherRiver = {
  weather: { tempC: 28, condition: "Partly Cloudy", risk: "LOW" },
  river: { levelM: 15.2, status: "NORMAL", sparkline: [14.8, 14.9, 15.0, 15.1, 15.0, 15.2, 15.2, 15.1, 15.2, 15.3, 15.2, 15.2] },
};

export const mockIncidents = [
  {
    id: "FIRE-24-0731",
    category: "FIRE",
    status: "PENDING",
    priority: "HIGH",
    location: "Sto. Nino, Marikina City",
    coords: { lat: 14.6395, lng: 121.108 },
    elapsedMinutes: 6,
    callerNotes: "Caller reports heavy smoke from a 2-storey residence, possible occupants trapped.",
    evidence: ["smoke_photo_1.jpg"],
  },
  {
    id: "MEDICAL-24-0455",
    category: "MEDICAL",
    status: "PENDING",
    priority: "HIGH",
    location: "Riverbanks, Marikina City",
    coords: { lat: 14.6363, lng: 121.0982 },
    elapsedMinutes: 3,
    callerNotes: "Elderly male, chest pains, conscious and breathing.",
    evidence: [],
  },
  {
    id: "CRIME-24-0902",
    category: "CRIME",
    status: "DISPATCHED",
    priority: "MEDIUM",
    location: "Concepcion Uno, Marikina City",
    coords: { lat: 14.6512, lng: 121.0959 },
    elapsedMinutes: 14,
    callerNotes: "Reported break-in, suspect fled on foot heading east.",
    evidence: ["cctv_still.jpg"],
  },
  {
    id: "CRIME-24-0903",
    category: "CRIME",
    status: "PENDING",
    priority: "LOW",
    location: "Malanday, Marikina City",
    coords: { lat: 14.658, lng: 121.1123 },
    elapsedMinutes: 21,
    callerNotes: "Noise complaint escalating into a dispute between neighbors.",
    evidence: [],
  },
  {
    id: "MEDICAL-24-0456",
    category: "MEDICAL",
    status: "PENDING",
    priority: "MEDIUM",
    location: "Tumana, Marikina City",
    coords: { lat: 14.6461, lng: 121.1066 },
    elapsedMinutes: 9,
    callerNotes: "Minor fall, possible fracture, patient is stable.",
    evidence: [],
  },
];

export const mockTally = { MEDICAL: 8, FIRE: 2, FLOOD: 0, CRIME: 4 };
