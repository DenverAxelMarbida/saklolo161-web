import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxMap } from "../hooks/useMapboxMap";

export default function MiniIncidentMap({ coords }) {
  const { containerRef, mapRef } = useMapboxMap({ center: coords, zoom: 15 });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const marker = new mapboxgl.Marker({ color: "#e4572e" })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);
    return () => marker.remove();
  }, [coords, mapRef]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[11px] text-ink">
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </div>
    </div>
  );
}
