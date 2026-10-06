import { useEffect, useRef } from "react";

// Escape-to-dismiss + focus containment for modal dialogs, mirroring the
// behavior ConfirmModal already establishes (focus moves into the dialog
// on open and returns to whatever opened it on close).
//
// The Escape listener only acts when the dialog it belongs to is the
// TOPMOST [role="dialog"][aria-modal="true"] element in the DOM, so
// dismissing a nested overlay (the EvidenceGallery lightbox rendered
// inside TriageModal / ResolvedDetailModal) never also closes the dialog
// behind it.
//
// `ref` must point at the element that carries role="dialog" +
// aria-modal="true". Dismissal never gates state — callers own that.
export function useDialogDismiss(ref, onDismiss) {
  const dismissRef = useRef(onDismiss);

  // Keep the latest dismissal handler reachable from the mount-only
  // listeners below without re-running them (re-running would re-capture
  // document.activeElement and break focus restoration — same pattern as
  // ConfirmModal).
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    ref.current?.focus();

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      event.preventDefault();
      dismissRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
    // Mount-only: focus capture/restore must happen exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
