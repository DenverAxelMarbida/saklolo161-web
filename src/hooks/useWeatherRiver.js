import { useEffect, useRef, useState } from "react";
import { getWeatherRiver } from "../lib/api";

/**
 * Fetches weather + river data once on mount and returns
 * { weather, river, loading, error }.
 *
 * This lives at the ControlRoom (parent) level so the fetch starts before
 * either card paints — avoiding the "mock shows first, then real data
 * flashes in" reload experience. Starts with loading=true (null data) so
 * cards can render a placeholder rather than fake values.
 */
export function useWeatherRiver() {
  const [data, setData] = useState({ weather: null, river: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    getWeatherRiver()
      .then((res) => {
        if (isMountedRef.current) setData(res);
      })
      .catch((err) => {
        if (isMountedRef.current) setError(err);
      })
      .finally(() => {
        if (isMountedRef.current) setLoading(false);
      });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { weather: data.weather, river: data.river, loading, error };
}
