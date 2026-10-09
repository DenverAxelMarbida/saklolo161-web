import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, MARIKINA_CENTER } from "../lib/config";

mapboxgl.accessToken = MAPBOX_TOKEN;

/**
 * Initializes a Mapbox GL map exactly once per component instance and
 * tears it down on unmount. Returns:
 *   - containerRef: attach to the <div> that should hold the map's canvas
 *   - mapRef: the live mapboxgl.Map instance, for other effects to draw on
 *     (markers, routes) without re-creating the map itself
 *   - loaded: true once the map's style has finished loading (the "load"
 *     event) — the honest signal for "the map is actually showing
 *     something", usable to gate a loading overlay.
 *   - loadFailed: true when a Mapbox error arrived BEFORE the style
 *     finished loading (bad token, offline, failed style fetch). Those
 *     are fatal — the style never comes up, so the "Loading map…"
 *     overlay would otherwise pulse forever over a dead canvas. Errors
 *     after "load" are tile-level and recoverable, so they never set it.
 */
export function useMapboxMap({
  center = MARIKINA_CENTER,
  zoom = 13,
  style = "mapbox://styles/mapbox/dark-v11",
} = {}) {
  const containerRef = useRef(null); // will hold the actual <div> DOM node
  const mapRef = useRef(null); // will hold the mapboxgl.Map instance
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

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

    // Local flag, not state: only the handlers below read it, and it
    // must flip in the same tick the events arrive (before React
    // re-renders), so pre-load vs post-load error classification is
    // race-free.
    let styleLoaded = false;
    const handleLoad = () => {
      styleLoaded = true;
      // A style that eventually loaded was never a failure — clears
      // any transient pre-load error that self-resolved.
      setLoadFailed(false);
      setLoaded(true);
    };
    const handleError = () => {
      if (!styleLoaded) setLoadFailed(true);
    };
    mapRef.current.once("load", handleLoad);
    mapRef.current.on("error", handleError);

    // Cleanup: destroy the map's WebGL context when the component
    // unmounts. Skipping this leaks GL contexts — browsers cap how many
    // can exist at once, so navigating between screens repeatedly
    // without cleanup eventually breaks map rendering entirely.
    return () => {
      mapRef.current?.off("error", handleError);
      mapRef.current?.remove();
      mapRef.current = null;
      // Reset for StrictMode's remount: the recreated map below must
      // earn `loaded` / `loadFailed` again from its own events.
      setLoaded(false);
      setLoadFailed(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps: create the map once; pan/zoom afterwards via the ref, not by re-running this effect

  return { containerRef, mapRef, loaded, loadFailed };
}
