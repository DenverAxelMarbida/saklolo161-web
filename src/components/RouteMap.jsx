import { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";
import { fetchRoute } from "../lib/api";

const ROUTE_SOURCE_ID = "dispatch-route";

function fallbackLine(stationCoords, incidentCoords) {
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

  // Real routed geometry comes from GET /api/routes. DispatchTracker passes
  // it in alongside its distance/ETA read; this component can also fetch it
  // itself. The straight line between both points stays the graceful
  // fallback whenever no real geometry is available (fetch failure, degraded
  // backend, or no route yet).
  const [fetchedGeometry, setFetchedGeometry] = useState(null);
  const [geometryFailed, setGeometryFailed] = useState(false);

  const stationLat = stationCoords?.lat;
  const stationLng = stationCoords?.lng;
  const incidentLat = incidentCoords?.lat;
  const incidentLng = incidentCoords?.lng;

  useEffect(() => {
    if (geometry) return;

    let cancelled = false;
    setFetchedGeometry(null);
    setGeometryFailed(false);

    if (
      stationLat == null ||
      stationLng == null ||
      incidentLat == null ||
      incidentLng == null
    ) {
      return;
    }

    fetchRoute({
      fromLat: stationLat,
      fromLng: stationLng,
      toLat: incidentLat,
      toLng: incidentLng,
    })
      .then((route) => {
        if (cancelled) return;
        if (route.geometry?.coordinates?.length >= 2) {
          setFetchedGeometry(route.geometry);
        } else {
          setGeometryFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGeometryFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [geometry, stationLat, stationLng, incidentLat, incidentLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (
      stationLat == null ||
      stationLng == null ||
      incidentLat == null ||
      incidentLng == null
    ) {
      return;
    }

    const stationMarker = new mapboxgl.Marker({ color: "#2f80ed" })
      .setLngLat([stationLng, stationLat])
      .addTo(map);
    const incidentMarker = new mapboxgl.Marker({ color: "#e4572e" })
      .setLngLat([incidentLng, incidentLat])
      .addTo(map);

    const resolvedGeometry = geometry ?? (geometryFailed ? null : fetchedGeometry);
    const line =
      resolvedGeometry?.coordinates?.length >= 2
        ? { type: "Feature", geometry: resolvedGeometry }
        : fallbackLine({ lat: stationLat, lng: stationLng }, { lat: incidentLat, lng: incidentLng });

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
      .extend([stationLng, stationLat])
      .extend([incidentLng, incidentLat]);
    map.fitBounds(bounds, { padding: 60 });

    return () => {
      stationMarker.remove();
      incidentMarker.remove();
    };
  }, [
    geometry,
    geometryFailed,
    fetchedGeometry,
    stationLat,
    stationLng,
    incidentLat,
    incidentLng,
    mapRef,
  ]);

  return <div ref={containerRef} className="h-full w-full" />;
}