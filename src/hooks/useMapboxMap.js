import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, MARIKINA_CENTER } from "../lib/config";

mapboxgl.accessToken = MAPBOX_TOKEN;

/**
 * Initializes a Mapbox GL map exactly once per component instance and
 * tears it down on unmount. Returns two refs:
 *   - containerRef: attach to the <div> that should hold the map's canvas
 *   - mapRef: the live mapboxgl.Map instance, for other effects to draw on
 *     (markers, routes) without re-creating the map itself.
 */
export function useMapboxMap({
  center = MARIKINA_CENTER,
  zoom = 13,
  style = "mapbox://styles/mapbox/dark-v11",
} = {}) {
  const containerRef = useRef(null); // will hold the actual <div> DOM node
  const mapRef = useRef(null); // will hold the mapboxgl.Map instance

  useEffect(() => {
    // Guard against double-initialization. In React 18 StrictMode (dev
    // only), effects intentionally run twice to help surface bugs like
    // this one — without the guard you'd get two overlapping map
    // instances fighting over the same container.
    if (mapRef.current) return;

    // containerRef.current is only non-null AFTER React has committed
    // the <div> to the real DOM, which is guaranteed by the time this
    // effect runs (effects fire after paint) — this is precisely why
    // Mapbox needs a ref instead of just a CSS selector string.
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style,
      center: [center.lng, center.lat], // Mapbox wants [lng, lat], the reverse of how most APIs quote coordinates
      zoom,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Cleanup: destroy the map's WebGL context when the component
    // unmounts. Skipping this leaks GL contexts — browsers cap how many
    // can exist at once, so navigating between screens repeatedly
    // without cleanup eventually breaks map rendering entirely.
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps: create the map once; pan/zoom afterwards via the ref, not by re-running this effect

  return { containerRef, mapRef };
}
