// Shared presentational language for the two admin sections
// (Account Management + Stations & Units) — one toolbar, one bulk
// bar, one chip, one focus treatment — so the sections read as parts
// of the same control room instead of drifting apart. Presentational
// ONLY: no data fetching, no auth, no business rules live here.
//
// Conventions (UI-UX Pro Max: consistency + visible keyboard focus,
// existing dark tokens only):
// - Controls share one height/padding/border treatment.
// - Keyboard focus is always visible (focus-visible ring); the old
//   focus:outline-none-with-border-only treatment is gone here.
// - Destructive bulk actions sit in a tinted bar, visually separated
//   from ordinary row buttons (which stay quiet ghosts).

// Visible keyboard-focus treatment shared by every control below.
// (Inputs keep their focus:border-medical too; the ring is what
// keyboard users actually see.)
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical/60";

export const fieldClassName =
  `mt-1 rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical ${focusRing} focus:outline-none`;

export function AdminToolbar({ label, children }) {
  return (
    <section
      aria-label={label}
      className="mt-4 rounded-lg border border-border bg-panel p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
        {label}
      </h3>
      <div className="mt-2 flex flex-wrap items-end gap-2">{children}</div>
    </section>
  );
}

export function SearchField({ id, label, placeholder, value, onChange }) {
  return (
    <div className="min-w-44 flex-1">
      <label
        className="text-xs uppercase tracking-wide text-ink-dim"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full ${fieldClassName}`}
      />
    </div>
  );
}

export function FilterSelect({ id, label, value, onChange, children }) {
  return (
    <div>
      <label
        className="text-xs uppercase tracking-wide text-ink-dim"
        htmlFor={id}
      >
        {label}
      </label>
      <div>
        <select
          id={id}
          value={value}
          onChange={onChange}
          className={fieldClassName}
        >
          {children}
        </select>
      </div>
    </div>
  );
}

export function ResetFiltersButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink ${focusRing}`}
    >
      Reset filters
    </button>
  );
}

// Tinted bar that sets the ONE destructive bulk action apart from the
// quiet per-row buttons. The count is a polite live region so screen
// readers hear selection changes.
export function BulkActionBar({
  countText,
  actionLabel,
  onAction,
  actionDisabled,
  onClear,
  showClear,
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-fire/30 bg-fire/5 px-3 py-2">
      <span className="text-sm text-ink-dim" aria-live="polite">
        {countText}
      </span>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className={`rounded-md border border-fire/40 bg-fire/10 px-3 py-1.5 text-sm font-semibold text-fire transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
      >
        {actionLabel}
      </button>
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className={`rounded-md border border-border px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink ${focusRing}`}
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

// "Showing X of Y" result count under the toolbar — visual only (the
// bulk-bar selection count already announces politely; announcing
// every keystroke here would be noise).
export function ResultCount({ shown, total, noun }) {
  return (
    <p className="mt-2 text-xs text-ink-dim">
      Showing {shown} of {total} {total === 1 ? noun : `${noun}s`}
    </p>
  );
}

const chipTones = {
  neutral: "border-white/10 bg-white/5 text-ink",
  danger: "border-fire/40 bg-fire/10 text-fire",
};

// Status/role/category chips — identical shape everywhere. `style`
// carries data-driven color only (e.g. the canonical category color
// from config); structure never varies.
export function Chip({ tone = "neutral", style, children }) {
  return (
    <span
      style={style}
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${chipTones[tone]}`}
    >
      {children}
    </span>
  );
}

// Quiet per-row ghost button shared by both tables.
export function RowButton({ onClick, disabled, danger, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60 ${focusRing} ${
        danger ? "hover:text-fire" : ""
      }`}
    >
      {children}
    </button>
  );
}
