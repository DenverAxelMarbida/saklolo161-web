import { useEffect, useId, useRef } from "react";

// Generic confirmation dialog for deliberate, session-affecting actions
// (currently: logging out). Shares ChangePasswordModal's overlay/panel/
// footer shell so the app keeps ONE modal look, and EvidenceGallery's
// dismissal rules (Escape + backdrop) so dismissal behaves the same way
// everywhere it exists today.
//
// Accessibility: the panel itself is the dialog (role/aria-modal/
// aria-labelledby + aria-describedby), focus moves to the safe action
// (Cancel) on open, and focus returns to whatever opened the dialog when
// it closes. Dismissal never gates state — callers own that.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  returnFocusRef,
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);
  const cancelHandlerRef = useRef(onCancel);

  // Keep the latest dismissal handler reachable from the mount-only
  // listeners below without re-running them (re-running would re-capture
  // document.activeElement and break focus restoration).
  useEffect(() => {
    cancelHandlerRef.current = onCancel;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    // Focus starts on the safe choice: a destructive dialog must never
    // leave the default action primed under the Enter key.
    cancelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") cancelHandlerRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const restoreTarget = returnFocusRef?.current || previouslyFocused;
      if (restoreTarget && typeof restoreTarget.focus === "function") {
        restoreTarget.focus();
      }
    };
    // Mount-only: focus capture/restore must happen exactly once.
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) cancelHandlerRef.current?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => cancelHandlerRef.current?.()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <p id={messageId} className="text-sm text-ink-dim">
            {message}
          </p>
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            ref={cancelRef}
            onClick={() => cancelHandlerRef.current?.()}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-fire px-3 py-2 text-sm font-semibold text-header transition-opacity hover:opacity-90 active:opacity-80"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
