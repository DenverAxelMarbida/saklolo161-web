import { useEffect, useRef } from "react";
import { CATEGORIES } from "../lib/config";

const AUTO_DISMISS_MS = 4500;

export default function NewIncidentToast({ toast, onClose }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timerId = setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timerId);
  }, [toast.id]);

  const categoryColor = CATEGORIES[toast.category]
    ? CATEGORIES[toast.category].color
    : "var(--color-flood)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-slide-up fixed top-16 right-4 z-40 w-72 rounded-md border border-border bg-panel p-3 shadow-lg shadow-black/40"
      style={{ borderLeft: `4px solid ${categoryColor}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink">
            New Incident
          </p>
          <p className="mt-1 truncate font-mono text-xs text-ink-dim">
            #{toast.id}
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: categoryColor }}>
            {toast.category}
            {toast.count > 1 && (
              <span className="font-normal text-ink-dim">
                {" "}· {toast.count - 1} more
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onCloseRef.current()}
          className="shrink-0 rounded border border-border px-1.5 text-xs text-ink-dim transition-colors hover:border-ink-dim hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
