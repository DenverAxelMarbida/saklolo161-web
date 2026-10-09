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

export default function IncidentMap({
  incidents,
  onSelectIncident,
  activeFilter,
  newIncidentIds = [],
  incidentsLoading = false,
}) {
  const { containerRef, mapRef, loaded, loadFailed } = useMapboxMap({ zoom: 12.5 });

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

        // Flags only the marker of an incident the 10s poll just flagged
        // as new; older markers are rendered exactly as before. The class
        // disappears on the next poll (newIncidentIds is replaced every
        // fetch), so nothing pulses forever. The ring color is carried in
        // a custom property so the keyframes can tint per category while
        // reusing the exact CATEGORIES hex (same fallback as the pin fill).
        if (newIncidentIds.includes(incident.id)) {
          el.style.setProperty(
            "--sak-pulse-color",
            CATEGORIES[incident.category]?.color || "#334155",
          );
          el.classList.add("animate-marker-pulse");
        }

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
  }, [incidents, mapRef, onSelectIncident, activeFilter, newIncidentIds]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* Honest "is there anything to look at yet?" gate: the blank grey
          canvas before Mapbox's style loads, and the first fetch, both
          get an explicit indicator instead of reading as an empty map.
          A pre-load failure is terminal for the canvas — swap the
          endless "Loading map…" pulse for an explicit, announced
          unavailable state (the queue/list still serves the data). */}
      {loadFailed && !loaded ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-bg/70 px-4 text-center"
        >
          <span className="text-xs font-semibold text-white">Map unavailable</span>
          <span className="text-xs text-ink-dim">
            The basemap failed to load. Incident details stay available in the queue.
          </span>
        </div>
      ) : (
        (!loaded || incidentsLoading) && (
          <div
            role="status"
            aria-label="Loading map"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-bg/70"
          >
            <span className="h-4 w-24 animate-pulse rounded bg-white/10" />
            <span className="text-xs text-ink-dim">Loading map…</span>
          </div>
        )
      )}
    </div>
  );
}
