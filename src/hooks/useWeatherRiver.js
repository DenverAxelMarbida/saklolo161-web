import { useCallback, useEffect, useRef, useState } from "react";
import { getWeatherRiver } from "../lib/api";

/**
 * Fetches weather + river data once on mount and returns
 * { weather, river, updatedAt, loading, error, refetch }.
 *
 * This lives at the ControlRoom (parent) level so the fetch starts before
 * either card paints — avoiding the "mock shows first, then real data
 * flashes in" reload experience. Starts with loading=true (null data) so
 * cards can render a placeholder rather than fake values.
 *
 * `refetch` mirrors useIncidentPolling's `refresh()` escape hatch: it
 * re-runs the same single fetch (kept behind the isMountedRef guard) so a
 * failed load can be retried from the cards instead of leaving a dead
 * "Loading…" placeholder. Existing data is kept visible while a retry is
 * in flight, and the interval/polling model is unchanged — this endpoint
 * is still fetched on mount only.
 */
export function useWeatherRiver() {
  const [data, setData] = useState({ weather: null, river: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetchSnapshot = useCallback(() => {
    setLoading(true);
    setError(null);
    return getWeatherRiver()
      .then((res) => {
        if (isMountedRef.current) {
          setData({ ...res, updatedAt: res.updatedAt ?? null });
          setError(null);
        }
      })
      .catch((err) => {
        if (isMountedRef.current) setError(err);
      })
      .finally(() => {
        if (isMountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    fetchSnapshot();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSnapshot]);

  return {
    weather: data.weather,
    river: data.river,
    updatedAt: data.updatedAt,
    loading,
    error,
    refetch: fetchSnapshot,
  };
}
