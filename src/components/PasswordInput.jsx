import { useState } from "react";

// Password field with a visibility ("eye") toggle inside the input's
// right edge.
//
// The wrapper owns ONLY the hidden/visible flag. The value, onChange,
// id, required, autoComplete, and every other input prop pass straight
// through, so each form keeps its labels, error messaging, requirement
// checklists, and submission logic exactly where they were — this adds
// no new form system, just the toggle.
//
// Why the toggle can't disturb anything:
// - type="button" -> clicking it can never submit the surrounding form.
// - Toggling only flips `type`; the DOM input (and therefore its value)
//   is never replaced, so no change/blur event fires, validation state
//   is untouched, and the caret position survives the switch.
// - preventDefault on mousedown keeps focus in the field for mouse
//   clicks (keyboard activation keeps focus on the button, which is the
//   correct behavior there).
// - Each instance has its own state, so fields toggle independently.
export default function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {/* pr-10 reserves the right gutter so typed text never slides
          under the toggle. Call sites use pl-3 (instead of px-3) so the
          left padding stays exactly as it was. */}
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`}
      />
      {/* Subtle by design: ink-dim at rest, ink on hover, and the global
          :focus-visible outline supplies the keyboard focus ring. */}
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((wasVisible) => !wasVisible)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {visible ? (
            // eye-off
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <path d="m1 1 22 22" />
            </>
          ) : (
            // eye
            <>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
