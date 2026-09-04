import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";
import { CATEGORIES } from "../lib/config";

const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, c]) => [key, c.label]),
);

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tooltipHTML(incident) {
  const label = CATEGORY_LABELS[incident.category] || incident.category || "UNKNOWN";
  const color = CATEGORIES[incident.category]?.color || "#334155";
  const elapsed = incident.elapsedMinutes ?? 0;

  return `
    <div class="sak-tooltip">
      <span class="sak-tooltip-cat" style="background:${color}">${escapeHtml(label)}</span>
      <span class="sak-tooltip-status">${escapeHtml(incident.status || "")}</span>
      <div class="sak-tooltip-row">Priority: <b>${escapeHtml(incident.priority || "")}</b></div>
      <div class="sak-tooltip-loc">${escapeHtml(incident.location || "Unknown location")}</div>
      <div class="sak-tooltip-elapsed">${elapsed} min ago</div>
    </div>
  `;
}

export default function IncidentMap({ incidents, onSelectIncident, activeFilter }) {
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
      .filter((i) => activeFilter === "ALL" || i.category === activeFilter)
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

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          offset: 12,
          className: "sak-tooltip-popup",
        }).setHTML(tooltipHTML(incident));

        el.addEventListener("mouseenter", () => {
          popup.setLngLat([incident.coords.lng, incident.coords.lat]).addTo(map);
        });
        el.addEventListener("mouseleave", () => popup.remove());

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([incident.coords.lng, incident.coords.lat])
          .addTo(map);

        marker._sakPopup = popup;

        markersRef.current.push(marker);
      });

    // No cleanup returned here on purpose: cleanup for THIS effect's
    // markers happens at the top of the next run, and final cleanup on
    // unmount is handled by useMapboxMap removing the whole map (which
    // takes its markers with it).
  }, [incidents, mapRef, onSelectIncident, activeFilter]);

  return <div ref={containerRef} className="h-full w-full" />;
}
