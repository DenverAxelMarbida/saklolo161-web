import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";

const ROUTE_SOURCE_ID = "dispatch-route";

export default function RouteMap({ stationCoords, incidentCoords }) {
  const { containerRef, mapRef } = useMapboxMap({ center: incidentCoords, zoom: 13.5 });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const stationMarker = new mapboxgl.Marker({ color: "#2f80ed" })
      .setLngLat([stationCoords.lng, stationCoords.lat])
      .addTo(map);
    const incidentMarker = new mapboxgl.Marker({ color: "#e4572e" })
      .setLngLat([incidentCoords.lng, incidentCoords.lat])
      .addTo(map);

    const line = {
      type: "Feature",
      geometry: {
        type: "LineString",
        // A straight line is a reasonable stand-in until the backend
        // returns a real routed path (e.g. from Mapbox's Directions API);
        // swap this for that response's `geometry` field once it exists.
        coordinates: [
          [stationCoords.lng, stationCoords.lat],
          [incidentCoords.lng, incidentCoords.lat],
        ],
      },
    };

    function drawRoute() {
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

    const bounds = new mapboxgl.LngLatBounds()
      .extend([stationCoords.lng, stationCoords.lat])
      .extend([incidentCoords.lng, incidentCoords.lat]);
    map.fitBounds(bounds, { padding: 60 });

    return () => {
      stationMarker.remove();
      incidentMarker.remove();
    };
  }, [stationCoords, incidentCoords, mapRef]);

  return <div ref={containerRef} className="h-full w-full" />;
}
