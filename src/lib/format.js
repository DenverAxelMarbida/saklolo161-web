/**
 * Formats an ISO timestamp (the backend's own response time) as a compact
 * clock label such as "14:32", or null when the value is absent/unusable —
 * callers render nothing rather than an "Updated Invalid Date" line.
 */
export function formatClock(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
