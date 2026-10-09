/**
 * Skeleton — presentational placeholder block for loading regions.
 *
 * Purely visual: always aria-hidden and nameless, so the meaning lives
 * on the surrounding role="status" region (see ActiveQueue /
 * CategoryTally / ResolvedLog / UserManagement for the pattern). Uses
 * Tailwind's animate-pulse, which the reduced-motion kill-switch in
 * index.css already disables.
 *
 * Props: className — size/layout utilities for the placeholder block
 * (class strings are written in full at each call site so the Tailwind
 * scanner can see them).
 */
export default function Skeleton({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-white/10 ${className}`}
    />
  );
}
