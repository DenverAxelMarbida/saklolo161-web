import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";

const ROUTE_SOURCE_ID = "dispatch-route";

// The backend returns a real routed path in geometry (GeoJSON LineString
// of [lng, lat] coords). Until that data lands, or when the route fetch
// fails, fall back to a plain 2-point straight line so the map never
// crashes on missing data. Returns null when there's no geometry AND no
// station coords to anchor a fallback line (nothing to draw).
function buildLine({ stationCoords, incidentCoords, geometry }) {
  const hasRoute =
    geometry &&
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2;

  if (hasRoute) {
    return { type: "Feature", geometry };
  }

  const hasStation =
    stationCoords &&
    stationCoords.lat != null &&
    stationCoords.lng != null;

  if (!hasStation) return null;

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [stationCoords.lng, stationCoords.lat],
        [incidentCoords.lng, incidentCoords.lat],
      ],
    },
  };
}

export default function RouteMap({ stationCoords, incidentCoords, geometry }) {
  const { containerRef, mapRef } = useMapboxMap({ center: incidentCoords, zoom: 13.5 });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incidentMarker = new mapboxgl.Marker({ color: "#e4572e" })
      .setLngLat([incidentCoords.lng, incidentCoords.lat])
      .addTo(map);

    const hasStation =
      stationCoords &&
      stationCoords.lat != null &&
      stationCoords.lng != null;

    let stationMarker = null;
    if (hasStation) {
      stationMarker = new mapboxgl.Marker({ color: "#2f80ed" })
        .setLngLat([stationCoords.lng, stationCoords.lat])
        .addTo(map);
    }

    const line = buildLine({ stationCoords, incidentCoords, geometry });

    function drawRoute() {
      if (!line) return;
      if (map.getSource(ROUTE_SOURCE_ID)) {
        map.getSource(ROUTE_SOURCE_ID).setData(line);
        return;
      }
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: line });
      map.addLayer({
        id: ROUTE_SOURCE_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2f80ed", "line-width": 3, "line-dasharray": [0.5, 1.5] },
      });
    }

    // Sources/layers can only be added once Mapbox's own style has
    // finished loading; `load` may already have fired by the time this
    // effect runs (e.g. on fast re-mounts), so check `isStyleLoaded()`
    // first instead of only ever listening for the event.
    if (map.isStyleLoaded()) {
      drawRoute();
    } else {
      map.once("load", drawRoute);
    }

    if (hasStation) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([stationCoords.lng, stationCoords.lat])
        .extend([incidentCoords.lng, incidentCoords.lat]);
      map.fitBounds(bounds, { padding: 60 });
    } else {
      map.jumpTo({ center: [incidentCoords.lng, incidentCoords.lat], zoom: 14 });
    }

    return () => {
      incidentMarker.remove();
      stationMarker?.remove();
    };
  }, [stationCoords, incidentCoords, geometry, mapRef]);

  return <div ref={containerRef} className="h-full w-full" />;
}
