import { useEffect, useRef, useState } from "react";
import { getIncidents } from "../lib/api";
import { mockIncidents } from "../data/mockIncidents";

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the backend for the live incident list every 10 seconds.
 * Returns { incidents, loading, error, refresh, newIncidentIds }.
 *
 * `refresh` lets a screen (e.g. right after a POST /dispatch) force an
 * immediate re-fetch instead of waiting up to 10s for the next tick.
 *
 * `newIncidentIds` holds only the IDs that appeared since the previous
 * successful fetch — empty on the first fetch (so the initial backlog is
 * never announced) and on any fetch that brings nothing new. `refresh()`
 * shares this logic with the interval, and IDs are remembered for the
 * whole session, so an incident that drops out and returns is never
 * announced twice.
 */
export function useIncidentPolling() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newIncidentIds, setNewIncidentIds] = useState([]);

  // A ref, not state, because "is this component still mounted" is not
  // something that should ever trigger a re-render — it's an internal
  // flag read only inside async callbacks and the cleanup function.
  const isMountedRef = useRef(true);

  // null until the first successful fetch seeds it. A ref (not state)
  // so every fetch closure sees the same set, and a Set (not an array)
  // so "have I seen this ID before" stays O(1) per incident.
  const knownIdsRef = useRef(null);

  const fetchIncidents = async () => {
    try {
      const data = await getIncidents();
      if (isMountedRef.current) {
        if (knownIdsRef.current === null) {
          knownIdsRef.current = new Set(data.map((incident) => incident.id));
          setNewIncidentIds([]);
        } else {
          const known = knownIdsRef.current;
          const fresh = [];
          for (const incident of data) {
            if (!known.has(incident.id)) {
              known.add(incident.id);
              fresh.push(incident.id);
            }
          }
          setNewIncidentIds(fresh);
        }
        setIncidents(data);
        setError(null);
      }
    } catch (err) {
      // Render's free tier cold-starts after idling, and during local dev
      // the backend may simply not be running yet — fall back to mock
      // data so the dashboard is still usable/demoable, but surface the
      // error so it's visible it's not live.
      //
      // Fallback data is never diffed as "new": knownIdsRef is left
      // untouched, so mock IDs can't poison the real-ID set and a
      // subsequent real fetch still seeds cleanly if nothing was seen yet.
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

  return { incidents, loading, error, refresh: fetchIncidents, newIncidentIds };
}
