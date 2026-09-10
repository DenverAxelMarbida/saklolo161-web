import { useEffect, useMemo, useState } from "react";

/**
 * EvidenceGallery
 * ---------------------------------------------------------------
 * Uniform thumbnail grid for incident evidence, with a dependency-free
 * lightbox. Used by both TriageModal and ResolvedDetailModal so the
 * evidence layout is consistent everywhere instead of each modal wrapping
 * mis-sized media into a ragged vertical stack.
 *
 * - Served media (truthy `url`) renders as uniform aspect-square
 *   thumbnails; videos show their first frame with a ▶ badge.
 * - Clicking a thumbnail opens a full-screen lightbox (enlarged photo /
 *   video player) with prev/next navigation, a counter, and
 *   Escape/backdrop/✕ to close.
 * - Records without a served url (legacy strings, pre-storage uploads)
 *   degrade to 📎 pill chips below the grid so nothing disappears.
 * ---------------------------------------------------------------
 */
export default function EvidenceGallery({ evidence }) {
  const items = evidence || [];

  // Viewable media = records with a server-served url. Everything else
  // becomes a pill. Indexed separately so lightbox navigation only walks
  // actual media, and pills never show up in the counter.
  const media = useMemo(
    () => items.filter((file) => typeof file !== "string" && file?.url),
    [items],
  );
  const pills = useMemo(
    () =>
      items.filter((file) => {
        if (typeof file === "string") return true;
        if (file?.url) return false;
        return true;
      }),
    [items],
  );

  const [lightboxIndex, setLightboxIndex] = useState(null);

  const open = (index) => setLightboxIndex(index);
  const close = () => setLightboxIndex(null);

  const step = (delta) => {
    if (lightboxIndex == null || media.length === 0) return;
    setLightboxIndex((lightboxIndex + delta + media.length) % media.length);
  };

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, media.length]);

  const active = lightboxIndex != null ? media[lightboxIndex] : null;

  return (
    <>
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map((file, idx) =>
            file.mimeType?.startsWith("video/") ? (
              <button
                key={file.fileId ?? file.url}
                type="button"
                onClick={() => open(idx)}
                aria-label={`Play evidence video ${idx + 1}`}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-bg"
              >
                <video
                  src={file.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-9 w-9 text-white drop-shadow"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            ) : (
              <button
                key={file.fileId ?? file.url}
                type="button"
                onClick={() => open(idx)}
                aria-label={`View evidence photo ${idx + 1}`}
                className="aspect-square overflow-hidden rounded-md border border-border bg-bg"
              >
                <img
                  src={file.url}
                  alt="Incident evidence"
                  className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                />
              </button>
            ),
          )}
        </div>
      )}

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pills.map((file, idx) => {
            const isVideo =
              typeof file !== "string" && file?.mimeType?.startsWith("video/");
            const label =
              typeof file === "string"
                ? file
                : `${isVideo ? "Video" : "Photo"} · ${file.sizeKb ?? 0} KB`;
            return (
              <span
                key={typeof file === "string" ? `str-${idx}` : (file.fileId ?? `ev-${idx}`)}
                className="inline-flex rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-ink-dim"
              >
                📎 {label}
              </span>
            );
          })}
        </div>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence ${lightboxIndex + 1} of ${media.length}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={close}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink-dim">
                {lightboxIndex + 1} / {media.length}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full border border-border bg-panel px-2.5 py-1 text-sm text-ink-dim transition-colors hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-black">
              {active.mimeType?.startsWith("video/") ? (
                <video
                  src={active.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[76vh] w-full"
                />
              ) : (
                <img
                  src={active.url}
                  alt="Incident evidence"
                  className="max-h-[76vh] w-full object-contain"
                />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous evidence"
                className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-ink transition-colors hover:text-ink-dim"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next evidence"
                className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-ink transition-colors hover:text-ink-dim"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}