import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";
import { CATEGORIES } from "../lib/config";

export default function IncidentMap({ incidents, onSelectIncident }) {
  const { containerRef, mapRef } = useMapboxMap({ zoom: 12.5 });

  // Markers are plain mapboxgl.Marker objects, not React elements — they
  // live outside React's render tree, so we track them ourselves in a
  // ref (a plain mutable array survives re-renders without re-triggering
  // one, unlike state).
  const markersRef = useRef([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wipe last render's markers before drawing this one's. Simplest
    // correct approach for a 10s-polling dashboard; a diffing strategy
    // only pays off once marker counts get large.
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    incidents
      .filter((i) => i.status !== "RESOLVED")
      .forEach((incident) => {
        const el = document.createElement("button");
        el.setAttribute("aria-label", `${incident.category} incident ${incident.id}`);
        el.style.width = "22px";
        el.style.height = "22px";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.cursor = "pointer";
        el.style.backgroundColor = CATEGORIES[incident.category]?.color || "#334155";

        el.addEventListener("click", () => onSelectIncident(incident));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([incident.coords.lng, incident.coords.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });

    // No cleanup returned here on purpose: cleanup for THIS effect's
    // markers happens at the top of the next run, and final cleanup on
    // unmount is handled by useMapboxMap removing the whole map (which
    // takes its markers with it).
  }, [incidents, mapRef, onSelectIncident]);

  return <div ref={containerRef} className="h-full w-full" />;
}
