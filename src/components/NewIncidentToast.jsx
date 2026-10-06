import { useEffect, useRef } from "react";
import { CATEGORIES } from "../lib/config";

const AUTO_DISMISS_MS = 4500;

// Neutral accent for unknown/missing categories — a visible but
// category-less gray-blue from the existing token palette (never a
// real category color, so a typo can't masquerade as FLOOD).
const NEUTRAL_ACCENT = "var(--color-ink-dim)";

export default function NewIncidentToast({ toast, onClose }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timerId = setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timerId);
  }, [toast.id]);

  // Resolve the category theme from the config single source of
  // truth (CATEGORIES). Casing is normalized here so the component
  // behaves the same regardless of how the API data arrives; the
  // config keys are the canonical UPPERCASE values.
  const rawCategory = typeof toast.category === "string" ? toast.category.trim() : "";
  const categoryKey = rawCategory.toUpperCase();
  const categoryEntry = CATEGORIES[categoryKey];

  const theme = categoryEntry
    ? { key: categoryKey.toLowerCase(), accent: categoryEntry.color }
    : { key: "neutral", accent: NEUTRAL_ACCENT };

  // Known categories display with the config label (canonical
  // casing); unknown ones show the raw value so ops can see what
  // actually arrived.
  const displayCategory = categoryEntry
    ? categoryEntry.label
    : rawCategory || "UNKNOWN";

  return (
    <div
      role="status"
      aria-live="polite"
      data-theme={theme.key}
      data-accent={theme.accent}
      className="animate-slide-up fixed top-16 right-4 z-40 w-72 rounded-md border border-border bg-panel p-3 shadow-lg shadow-black/40"
      style={{
        borderLeft: `4px solid ${theme.accent}`,
        // Subtle left-to-right category wash over the panel — same
        // color-mix approach the marker pulse in index.css already uses.
        backgroundImage: `linear-gradient(to right, color-mix(in srgb, ${theme.accent} 14%, transparent), transparent 70%)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink">
            New Incident
          </p>
          <p className="mt-1 truncate font-mono text-xs text-ink-dim">
            #{toast.id}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: theme.accent }}
            />
            <span className="uppercase tracking-wide text-ink">
              {displayCategory}
            </span>
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
