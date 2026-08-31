import { useEffect, useRef, useState } from "react";
import { getIncidents } from "../lib/api";
import { mockIncidents } from "../data/mockIncidents";

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the backend for the live incident list every 10 seconds.
 * Returns { incidents, loading, error, refresh }.
 *
 * `refresh` lets a screen (e.g. right after a POST /dispatch) force an
 * immediate re-fetch instead of waiting up to 10s for the next tick.
 */
export function useIncidentPolling() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A ref, not state, because "is this component still mounted" is not
  // something that should ever trigger a re-render — it's an internal
  // flag read only inside async callbacks and the cleanup function.
  const isMountedRef = useRef(true);

  const fetchIncidents = async () => {
    try {
      const data = await getIncidents();
      if (isMountedRef.current) {
        setIncidents(data);
        setError(null);
      }
    } catch (err) {
      // Render's free tier cold-starts after idling, and during local dev
      // the backend may simply not be running yet — fall back to mock
      // data so the dashboard is still usable/demoable, but surface the
      // error so it's visible it's not live.
      if (isMountedRef.current) {
        setError(err);
        setIncidents((prev) => (prev.length ? prev : mockIncidents));
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    fetchIncidents(); // fire immediately — don't make the user wait 10s for first paint

    const intervalId = setInterval(fetchIncidents, POLL_INTERVAL_MS);

    // Cleanup runs when the component unmounts (or before the effect
    // re-runs, though with an empty dependency array that never happens
    // here). Without this, the interval keeps firing after the component
    // is gone — a classic React memory leak / "setState on unmounted
    // component" warning source.
    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, []); // empty deps: set up the interval once, on mount, never re-create it

  return { incidents, loading, error, refresh: fetchIncidents };
}
