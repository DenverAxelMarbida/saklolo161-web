import { useCallback, useEffect, useRef, useState } from "react";
import {
  listStations,
  createStation,
  updateStation,
  setStationActive,
  addUnit,
  updateUnit,
  setUnitActive,
} from "../lib/api";
import { useDialogDismiss } from "../hooks/useDialogDismiss";
import AdminPasswordModal from "./AdminPasswordModal";
import Skeleton from "./Skeleton";

// Backend Title-Case categories (the dispatch contract). The web
// CATEGORIES keys are UPPERCASE display keys — the modal maps between
// them only when seeding defaults, never for persistence.
const BACKEND_CATEGORIES = ["Medical", "Fire", "Flood", "Crime"];

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || fallback;

// Backend units arrive normalized ({ id, name, isActive }); legacy
// records may still carry plain strings — normalize at the boundary
// so every row below works with one shape.
const normalizeUnits = (station) =>
  (station?.assignedUnits ?? []).map((u) =>
    typeof u === "string"
      ? { id: u, name: u, isActive: true }
      : { id: u.id, name: u.name, isActive: u.isActive !== false },
  );

// Client-side mirror of the backend's unit validation
// (services/stationService.js validateUnitPayload) so a bad draft
// fails fast in the modal, before any request goes out.
const validateUnitDraft = (draft) => {
  const errors = [];
  const seen = new Set();
  for (const entry of draft) {
    const label = entry.isNew
      ? `New unit "${entry.id || "??"}"`
      : `Unit "${entry.id}"`;
    if (!entry.name || !entry.name.trim()) {
      errors.push(`${label}: name is required.`);
    } else if (entry.name.trim().length > 120) {
      errors.push(`${label}: name must be at most 120 characters.`);
    }
    if (entry.isNew) {
      if (!entry.id) {
        errors.push("New unit: ID is required.");
      } else if (/[.#$[\]/]/.test(entry.id)) {
        errors.push(`New unit "${entry.id}": ID must not contain . # $ [ ] / characters.`);
      }
      if (entry.id && seen.has(entry.id)) {
        errors.push(`Duplicate unit ID "${entry.id}".`);
      }
      seen.add(entry.id);
    }
  }
  return errors;
};

const emptyStationForm = () => ({
  id: "",
  name: "",
  category: BACKEND_CATEGORIES[0],
  phone: "",
  lat: "",
  lng: "",
  estimatedTurnout: "",
});

const stationToForm = (station) => ({
  id: station.id,
  name: station.name ?? "",
  category: station.category ?? BACKEND_CATEGORIES[0],
  phone: station.phone ?? "",
  lat: station.coords?.lat ?? "",
  lng: station.coords?.lng ?? "",
  estimatedTurnout: station.estimatedTurnout ?? "",
});

// TriageModal-style overlay form for add/edit. The station id exists
// for ADD ONLY — ids are immutable once created (the backend rejects
// id changes). Coordinates are free-text inputs parsed to numbers;
// the backend re-validates ranges server-side. Edit mode additionally
// receives a `children` section — the assigned-units manager (list +
// inline add) — so unit management lives inside this one modal.
function StationFormModal({ mode, form, setForm, error, saving, onCancel, onSubmit, children }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);
  const isAdd = mode === "add";

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={isAdd ? "Add Station" : "Edit Station"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="max-h-[90vh] w-full max-w-md animate-pop-in overflow-y-auto rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {isAdd ? "Add Station" : "Edit Station"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          {isAdd && (
            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-id">
                Station ID
              </label>
              <input
                id="station-id"
                type="text"
                placeholder="e.g. MEDICAL_NEW_BASE"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm focus:border-medical focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-dim">
                3–64 chars: A–Z, 0–9, underscore. Cannot be changed later.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-name">
              Name
            </label>
            <input
              id="station-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-category">
              Category
            </label>
            <select
              id="station-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            >
              {BACKEND_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-phone">
              Contact Number
            </label>
            <input
              id="station-phone"
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-lat">
                Latitude
              </label>
              <input
                id="station-lat"
                type="text"
                inputMode="decimal"
                placeholder="14.6507"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-lng">
                Longitude
              </label>
              <input
                id="station-lng"
                type="text"
                inputMode="decimal"
                placeholder="121.1029"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="station-turnout">
              Estimated Turnout
            </label>
            <input
              id="station-turnout"
              type="text"
              placeholder="e.g. 3–5 mins"
              value={form.estimatedTurnout}
              onChange={(e) => setForm({ ...form, estimatedTurnout: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-fire">{error}</p>}

          {children}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            {saving ? "Saving…" : isAdd ? "Create Station" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Rename-only dialog for a unit inside a station (the old add-mode
// moved inline into the Edit Station modal — see the units section
// passed to StationFormModal). Unit ids are immutable (the backend
// rejects id changes); edits rename the unit in place.
function UnitFormModal({ unit, form, setForm, error, saving, onCancel, onSubmit }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Unit"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Edit Unit
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="font-mono text-xs text-ink-dim">{unit.id}</p>
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="unit-name">
              Unit Name
            </label>
            <input
              id="unit-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-fire">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 rounded-md bg-medical py-2 text-sm font-semibold text-bg transition-opacity disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusBadge = (isActive) => (
  <span
    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
      isActive === false
        ? "border-fire/40 bg-fire/10 text-fire"
        : "border-white/10 bg-white/5"
    }`}
  >
    {isActive === false ? "Inactive" : "Active"}
  </span>
);

// Standalone it owns its full-page scroll wrapper; embedded inside
// Settings it renders just its content (same pattern as
// UserManagement — Settings owns the scroll/padding).
export default function StationManagement({ embedded = false }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [bannerError, setBannerError] = useState(null);
  const [bannerOk, setBannerOk] = useState(null);
  const [stationModal, setStationModal] = useState(null); // { mode: "add" } | { mode: "edit", station }
  const [stationForm, setStationForm] = useState(emptyStationForm());
  const [stationModalError, setStationModalError] = useState(null);
  const [savingStation, setSavingStation] = useState(false);
  // Edit-mode admin reauthentication (the actual update only runs
  // from this verification step — see commitStationEdit).
  const [verifyingStationEdit, setVerifyingStationEdit] = useState(false);
  const [stationVerifyError, setStationVerifyError] = useState(null);
  // Deactivation runs through its own admin-verification dialog
  // (replacing the old inline Confirm-deactivate two-step).
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateError, setDeactivateError] = useState(null);
  const [pendingToggleId, setPendingToggleId] = useState(null);
  // Units live inside the Edit Station modal as a PENDING DRAFT:
  // adds and renames update only this list until Save Changes commits
  // everything (station fields + units) after admin reauthentication.
  // Unit activate/deactivate stays an immediate inline action (same
  // two-step confirm as before).
  const [unitDraft, setUnitDraft] = useState([]); // { id, name, origName, isActive, isNew }
  const [newUnitForm, setNewUnitForm] = useState({ id: "", name: "" });
  const [unitAddError, setUnitAddError] = useState(null);
  const [unitModal, setUnitModal] = useState(null); // { unitId } — rename dialog
  const [unitForm, setUnitForm] = useState({ id: "", name: "" });
  const [unitModalError, setUnitModalError] = useState(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [confirmUnitId, setConfirmUnitId] = useState(null);
  const [pendingUnitToggleId, setPendingUnitToggleId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listStations({ includeInactive: true });
      setStations(list);
      return list;
    } catch (err) {
      setLoadError(
        errorMessage(err, "Couldn't load stations. Check your connection and try again."),
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flashOk = (message) => {
    setBannerOk(message);
    setBannerError(null);
  };

  const flashError = (message) => {
    setBannerError(message);
    setBannerOk(null);
  };

  const openAddStation = () => {
    setStationForm(emptyStationForm());
    setStationModalError(null);
    setStationModal({ mode: "add" });
  };

  const openEditStation = (station) => {
    setStationForm(stationToForm(station));
    setStationModalError(null);
    // Seed the pending-unit draft from the server's current units —
    // every add/rename from here on touches only this draft until
    // Save Changes commits after admin reauthentication.
    setUnitDraft(
      normalizeUnits(station).map((u) => ({
        id: u.id,
        name: u.name,
        origName: u.name,
        isActive: u.isActive,
        isNew: false,
      })),
    );
    setNewUnitForm({ id: "", name: "" });
    setUnitAddError(null);
    setUnitModal(null);
    setConfirmUnitId(null);
    setStationModal({ mode: "edit", station });
  };

  const parseCoords = (form) => {
    const latEmpty = String(form.lat).trim() === "";
    const lngEmpty = String(form.lng).trim() === "";
    if (latEmpty && lngEmpty) return { ok: true, coords: null };
    if (latEmpty || lngEmpty) return { ok: false, error: "Enter both latitude and longitude, or leave both blank." };
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: "Coordinates must be numbers (e.g. 14.6507, 121.1029)." };
    }
    return { ok: true, coords: { lat, lng } };
  };

  const handleSaveStation = async () => {
    setStationModalError(null);
    const parsed = parseCoords(stationForm);
    if (!parsed.ok) {
      setStationModalError(parsed.error);
      return;
    }
    if (stationModal.mode === "add") {
      setSavingStation(true);
      try {
        await createStation({
          id: stationForm.id.trim(),
          name: stationForm.name.trim(),
          category: stationForm.category,
          phone: stationForm.phone,
          coords: parsed.coords,
          estimatedTurnout: stationForm.estimatedTurnout,
        });
        flashOk("Station created.");
        setStationModal(null);
        await load();
      } catch (err) {
        setStationModalError(
          errorMessage(err, "Couldn't create the station. Try again."),
        );
      } finally {
        setSavingStation(false);
      }
      return;
    }
    // Edit of an EXISTING station: validate station fields AND the
    // pending unit draft, then open the admin-password verification
    // step. Nothing is sent yet — commitStationEdit only runs after
    // the admin re-proves their OWN password, and the backend
    // re-verifies it server-side before applying anything.
    const draftProblems = validateUnitDraft(unitDraft);
    if (draftProblems.length > 0) {
      setStationModalError(draftProblems.join(" "));
      return;
    }
    setStationVerifyError(null);
    setVerifyingStationEdit(true);
  };

  // Single commit for Save Changes: station fields first (that PATCH
  // carries the admin password, so a wrong password persists
  // NOTHING), then the pending unit adds/renames sequentially. The
  // backend has no atomic station+units transaction — each unit is
  // its own admin request — so partial failures keep the modal open,
  // refresh server truth, and reconcile the draft so a retry only
  // sends what is still missing (never a duplicate create).
  const commitStationEdit = async (adminPassword) => {
    setSavingStation(true);
    setStationVerifyError(null);
    const stationId = stationModal.station.id;

    try {
      const parsed = parseCoords(stationForm);
      if (!parsed.ok) {
        // Defensive: handleSaveStation already validated, but the
        // form can't change while the verify dialog is open.
        setStationVerifyError(parsed.error);
        setSavingStation(false);
        return;
      }
      await updateStation(stationId, {
        name: stationForm.name.trim(),
        category: stationForm.category,
        phone: stationForm.phone,
        coords: parsed.coords,
        estimatedTurnout: stationForm.estimatedTurnout,
        adminPassword,
      });
    } catch (err) {
      // Wrong admin password / backend failure: stay on the
      // verification dialog (the edit modal stays open behind it) so
      // the password can be corrected. Nothing has been persisted.
      setStationVerifyError(
        errorMessage(err, "Couldn't save the changes. Try again."),
      );
      setSavingStation(false);
      return;
    }

    // Station fields are saved (password accepted). Now the pending
    // unit operations — one request each, in draft order.
    const failures = [];
    for (const entry of unitDraft) {
      try {
        if (entry.isNew) {
          await addUnit(stationId, { id: entry.id, name: entry.name.trim() });
        } else if (entry.name.trim() !== entry.origName) {
          await updateUnit(stationId, entry.id, { name: entry.name.trim() });
        } else {
          continue; // untouched existing unit — nothing to send
        }
      } catch (err) {
        failures.push(
          `${entry.isNew ? `Adding "${entry.id}"` : `Renaming "${entry.id}"`} failed: ${errorMessage(err, "request failed.")}`,
        );
      }
    }

    if (failures.length === 0) {
      flashOk("Station updated.");
      setVerifyingStationEdit(false);
      setStationModal(null);
      setUnitDraft([]);
      setSavingStation(false);
      await load();
      return;
    }

    // Partial failure: refresh server truth and reconcile the draft —
    // adds that actually landed are dropped (retry can never
    // duplicate them), renames that landed are marked clean, and
    // everything still pending stays visible for a safe retry.
    const freshList = (await load()) || stations;
    const freshStation = freshList.find((s) => s.id === stationId);
    if (freshStation) {
      const freshUnits = normalizeUnits(freshStation);
      setUnitDraft((draft) =>
        draft
          .map((entry) => {
            const server = freshUnits.find((u) => u.id === entry.id);
            if (entry.isNew) return server ? null : entry; // created → drop
            if (!server) return entry;
            const renameLanded = server.name === entry.name.trim();
            return {
              ...entry,
              name: renameLanded ? server.name : entry.name,
              origName: server.name,
              isActive: server.isActive,
            };
          })
          .filter(Boolean),
      );
    }
    setVerifyingStationEdit(false);
    setSavingStation(false);
    const report = `Station fields saved, but some unit changes failed — review the remaining changes and save again. ${failures.join(" ")}`;
    flashError(report);
    setStationModalError(report);
  };

  const handleSetStationActive = async (station, isActive, adminPassword) => {
    // One toggle at a time: a double-click must never fire a second
    // PATCH for the same (or another) row.
    if (pendingToggleId != null) return;
    setPendingToggleId(station.id);
    flashError(null);
    setBannerOk(null);
    try {
      await setStationActive(
        station.id,
        isActive,
        adminPassword ? { adminPassword } : {},
      );
      setDeactivateTarget(null);
      setDeactivateError(null);
      flashOk(isActive ? "Station activated." : "Station deactivated.");
      await load();
    } catch (err) {
      const message = errorMessage(
        err,
        "Couldn't update the station status. Try again.",
      );
      if (!isActive) {
        // Deactivation runs from the verification dialog — keep it
        // open so a wrong password can be corrected without
        // re-opening anything. The station stays active.
        setDeactivateError(message);
      } else {
        setDeactivateTarget(null);
        flashError(message);
      }
    } finally {
      setPendingToggleId(null);
    }
  };

  // Inline "Add Unit" inside the Edit Station modal — appends to the
  // PENDING draft only. Nothing is sent until Save Changes commits
  // after admin reauthentication (same rules as the backend:
  // non-empty id ≤64 chars without . # $ [ ] /, name ≤120 chars,
  // id unique within the station).
  const handleAddUnitInline = () => {
    const id = newUnitForm.id.trim();
    const name = newUnitForm.name.trim();
    const errors = [];
    if (!id) {
      errors.push("Unit ID is required.");
    } else if (id.length > 64) {
      errors.push("Unit ID must be at most 64 characters.");
    } else if (/[.#$[\]/]/.test(id)) {
      errors.push("Unit ID must not contain . # $ [ ] / characters.");
    }
    if (!name) {
      errors.push("Unit name is required.");
    } else if (name.length > 120) {
      errors.push("Unit name must be at most 120 characters.");
    }
    if (!errors.length && unitDraft.some((u) => u.id === id)) {
      errors.push(`Unit "${id}" already exists in this station.`);
    }
    if (errors.length) {
      setUnitAddError(errors.join(" "));
      return;
    }
    setUnitAddError(null);
    setUnitDraft([
      ...unitDraft,
      { id, name, origName: null, isActive: true, isNew: true },
    ]);
    setNewUnitForm({ id: "", name: "" });
  };

  const removeDraftUnit = (unitId) => {
    setUnitDraft((draft) => draft.filter((e) => !(e.isNew && e.id === unitId)));
  };

  const openEditUnit = (unitId) => {
    const entry = unitDraft.find((u) => u.id === unitId);
    if (!entry) return;
    setUnitForm({ id: entry.id, name: entry.name });
    setUnitModalError(null);
    setUnitModal({ unitId });
  };

  // Rename dialog updates the DRAFT only — no request until Save
  // Changes. Same validation rules the backend enforces.
  const handleSaveUnit = () => {
    const name = unitForm.name.trim();
    if (!name) {
      setUnitModalError("Unit name is required.");
      return;
    }
    if (name.length > 120) {
      setUnitModalError("Unit name must be at most 120 characters.");
      return;
    }
    setSavingUnit(true);
    setUnitDraft((draft) =>
      draft.map((e) => (e.id === unitModal.unitId ? { ...e, name } : e)),
    );
    setUnitModal(null);
    setSavingUnit(false);
  };

  // Unit activate/deactivate is an immediate action (unchanged
  // two-step confirm, no admin password per scope) — sync the draft
  // entry's badge after the server confirms.
  const handleSetUnitActive = async (stationId, unit, isActive) => {
    if (pendingUnitToggleId != null) return;
    setPendingUnitToggleId(unit.id);
    setBannerOk(null);
    setBannerError(null);
    try {
      await setUnitActive(stationId, unit.id, isActive);
      setConfirmUnitId(null);
      setUnitDraft((draft) =>
        draft.map((e) => (e.id === unit.id ? { ...e, isActive } : e)),
      );
      flashOk(isActive ? "Unit activated." : "Unit deactivated.");
      await load();
    } catch (err) {
      setConfirmUnitId(null);
      flashError(errorMessage(err, "Couldn't update the unit status. Try again."));
    } finally {
      setPendingUnitToggleId(null);
    }
  };

  // Fresh copy of the station being edited (kept current through
  // load() after mutations — e.g. an inline unit add refreshes the
  // modal's units list without losing unsaved station-field edits).
  const editStation = stationModal?.mode === "edit"
    ? stations.find((s) => s.id === stationModal.station.id) ?? stationModal.station
    : null;

  const Heading = embedded ? "h2" : "h1";

  return (
    <div className={embedded ? "" : "h-full overflow-y-auto p-6"}>
      <div className={embedded ? "" : "mx-auto w-full max-w-4xl"}>
        <div className="flex items-center justify-between">
          <div>
            <Heading className="text-lg font-semibold">Stations &amp; Units</Heading>
            <p className="text-sm text-ink-dim">
              Manage response stations and their assigned units. Deactivation
              preserves dispatch history — records are never deleted.
            </p>
          </div>
          <button
            onClick={openAddStation}
            className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            Add Station
          </button>
        </div>

        {bannerOk && (
          <p className="mt-4 rounded border border-resolved/40 bg-resolved/10 p-3 text-sm text-resolved">
            {bannerOk}
          </p>
        )}

        {bannerError && (
          <p className="mt-4 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire">
            {bannerError}
          </p>
        )}

        {/* Initial load only (no rows yet) gets the skeleton; a
            background refetch after a mutation keeps the rows up. */}
        {loading && stations.length === 0 && (
          <div
            role="status"
            aria-label="Loading stations"
            className="mt-6 space-y-2"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border bg-panel p-3"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Failure keeps any stale rows visible alongside the error —
            never swap a populated list for an empty-looking one.
            role="alert" announces the failure; Retry re-runs load(). */}
        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded border border-fire/40 bg-fire/10 p-3 text-sm text-fire"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="ml-2 rounded border border-fire/50 px-2 py-0.5 font-semibold hover:bg-fire/20 disabled:opacity-60"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && stations.length === 0 && (
          <p className="mt-6 text-center text-sm text-ink-dim">No stations found.</p>
        )}

        {stations.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-dim">
                  <th className="py-2 pr-3">Station</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Turnout</th>
                  <th className="py-2 pr-3">Units</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station) => {
                  const units = normalizeUnits(station);
                  const active = station.isActive !== false;
                  return (
                    <tr key={station.id} className="border-b border-border align-top">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{station.name}</div>
                        <div className="font-mono text-xs text-ink-dim">{station.id}</div>
                      </td>
                      <td className="py-2.5 pr-3">{station.category}</td>
                      <td className="py-2.5 pr-3">{station.phone || "—"}</td>
                      <td className="py-2.5 pr-3">{station.estimatedTurnout || "—"}</td>
                      <td className="py-2.5 pr-3">{units.length}</td>
                      <td className="py-2.5 pr-3">{statusBadge(station.isActive)}</td>
                      <td className="py-2.5 text-right">
                        <span className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditStation(station)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                          >
                            Edit
                          </button>
                          {active ? (
                            <button
                              onClick={() => {
                                setDeactivateError(null);
                                setDeactivateTarget(station);
                              }}
                              disabled={pendingToggleId != null}
                              className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire disabled:opacity-60"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetStationActive(station, true)}
                              disabled={pendingToggleId != null}
                              className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                            >
                              Activate
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {stationModal && (
        <StationFormModal
          mode={stationModal.mode}
          form={stationForm}
          setForm={setStationForm}
          error={stationModalError}
          saving={savingStation}
          onCancel={() => setStationModal(null)}
          onSubmit={handleSaveStation}
        >
          {/* Assigned units live inside the edit modal — view, add,
              rename, deactivate. Add mode has no station yet. */}
          {editStation && (
            <div
              aria-label={`Assigned units for ${editStation.name}`}
              className="border-t border-border pt-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wide text-ink-dim">
                  Assigned Units
                </h3>
                <span className="font-mono text-xs text-ink-dim">{editStation.id}</span>
              </div>

              {unitDraft.length === 0 ? (
                <p className="mt-3 text-center text-sm text-ink-dim">
                  No units assigned yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                  {unitDraft.map((unit) => (
                    <li
                      key={unit.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{unit.name}</div>
                        <div className="font-mono text-xs text-ink-dim">{unit.id}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {statusBadge(unit.isActive)}
                        {/* Pending-state markers: draft-only until Save
                            Changes commits everything after reauth. */}
                        {unit.isNew && (
                          <span className="rounded border border-medical/40 bg-medical/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-medical">
                            New
                          </span>
                        )}
                        {!unit.isNew && unit.name !== unit.origName && (
                          <span className="rounded border border-ink-dim/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-dim">
                            Unsaved
                          </span>
                        )}
                        <button
                          onClick={() => openEditUnit(unit.id)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                        >
                          Edit
                        </button>
                        {unit.isNew ? (
                          <button
                            onClick={() => removeDraftUnit(unit.id)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire"
                          >
                            Remove
                          </button>
                        ) : unit.isActive !== false ? (
                          confirmUnitId === unit.id ? (
                            <>
                              <button
                                onClick={() => handleSetUnitActive(editStation.id, unit, false)}
                                disabled={pendingUnitToggleId != null}
                                className="rounded-md border border-fire/40 bg-fire/10 px-2 py-1 text-xs font-semibold text-fire disabled:opacity-60"
                              >
                                Confirm deactivate
                              </button>
                              <button
                                onClick={() => setConfirmUnitId(null)}
                                disabled={pendingUnitToggleId != null}
                                className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmUnitId(unit.id)}
                              disabled={pendingUnitToggleId != null}
                              className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire disabled:opacity-60"
                            >
                              Deactivate
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleSetUnitActive(editStation.id, unit, true)}
                            disabled={pendingUnitToggleId != null}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Inline add — appends to the PENDING draft only. The
                  unit is created by Save Changes (after admin
                  reauthentication), never by this button. */}
              <div className="mt-3 rounded-md border border-border p-3">
                <h4 className="text-xs uppercase tracking-wide text-ink-dim">
                  Add Unit
                </h4>
                <div className="mt-2 grid gap-2">
                  <input
                    type="text"
                    aria-label="New Unit ID"
                    placeholder="Unit ID (unique within this station)"
                    value={newUnitForm.id}
                    onChange={(e) => setNewUnitForm({ ...newUnitForm, id: e.target.value })}
                    className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm focus:border-medical focus:outline-none"
                  />
                  <input
                    type="text"
                    aria-label="New Unit Name"
                    placeholder="Unit Name"
                    value={newUnitForm.name}
                    onChange={(e) => setNewUnitForm({ ...newUnitForm, name: e.target.value })}
                    className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-medical focus:outline-none"
                  />
                </div>
                {unitAddError && (
                  <p className="mt-2 text-xs text-fire">{unitAddError}</p>
                )}
                <button
                  onClick={handleAddUnitInline}
                  disabled={
                    newUnitForm.id.trim().length === 0 ||
                    newUnitForm.name.trim().length === 0
                  }
                  className="mt-3 rounded-md bg-medical px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Add Unit
                </button>
              </div>
            </div>
          )}
        </StationFormModal>
      )}

      {verifyingStationEdit && stationModal && (
        <AdminPasswordModal
          ariaLabel="Verify Admin Password"
          title="Confirm Station Changes"
          description={
            <p className="text-sm">
              Save your changes to{" "}
              <span className="font-semibold">{stationModal.station.name}</span>?
            </p>
          }
          confirmLabel="Save Changes"
          savingLabel="Saving…"
          tone="primary"
          saving={savingStation}
          error={stationVerifyError}
          onCancel={() => {
            setVerifyingStationEdit(false);
            setStationVerifyError(null);
          }}
          onSubmit={commitStationEdit}
        />
      )}

      {deactivateTarget && (
        <AdminPasswordModal
          ariaLabel="Deactivate Station"
          title="Deactivate Station"
          description={
            <p className="text-sm">
              Deactivate{" "}
              <span className="font-semibold">{deactivateTarget.name}</span>?
              Dispatching to this station stops until it is reactivated —
              dispatch history is preserved.
            </p>
          }
          confirmLabel="Confirm Deactivate"
          savingLabel="Deactivating…"
          saving={pendingToggleId != null}
          error={deactivateError}
          onCancel={() => {
            setDeactivateTarget(null);
            setDeactivateError(null);
          }}
          onSubmit={(adminPassword) =>
            handleSetStationActive(deactivateTarget, false, adminPassword)
          }
        />
      )}

      {unitModal && (
        <UnitFormModal
          unit={unitDraft.find((u) => u.id === unitModal.unitId) ?? { id: unitModal.unitId, name: unitForm.name }}
          form={unitForm}
          setForm={setUnitForm}
          error={unitModalError}
          saving={savingUnit}
          onCancel={() => setUnitModal(null)}
          onSubmit={handleSaveUnit}
        />
      )}
    </div>
  );
}
