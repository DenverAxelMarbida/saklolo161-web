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
// the backend re-validates ranges server-side.
function StationFormModal({ mode, form, setForm, error, saving, onCancel, onSubmit }) {
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

// Unit id exists for ADD ONLY — ids are immutable (the backend
// rejects id changes); edits rename the unit in place.
function UnitFormModal({ mode, form, setForm, error, saving, onCancel, onSubmit }) {
  const rootRef = useRef(null);
  useDialogDismiss(rootRef, onCancel);
  const isAdd = mode === "add";

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={isAdd ? "Add Unit" : "Edit Unit"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 focus:outline-none animate-fade-in"
    >
      <div className="w-full max-w-md animate-pop-in overflow-hidden rounded-lg border border-border bg-panel shadow-modal">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {isAdd ? "Add Unit" : "Edit Unit"}
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
              <label className="text-xs uppercase tracking-wide text-ink-dim" htmlFor="unit-id">
                Unit ID
              </label>
              <input
                id="unit-id"
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm focus:border-medical focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-dim">
                Unique within this station. Cannot be changed later.
              </p>
            </div>
          )}

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
            {saving ? "Saving…" : isAdd ? "Add Unit" : "Save Changes"}
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
  const [confirmStationId, setConfirmStationId] = useState(null);
  const [pendingToggleId, setPendingToggleId] = useState(null);
  // Units panel: which station's units are being managed + unit modal state.
  const [unitsForStationId, setUnitsForStationId] = useState(null);
  const [unitModal, setUnitModal] = useState(null); // { mode: "add", stationId } | { mode: "edit", stationId, unit }
  const [unitForm, setUnitForm] = useState({ id: "", name: "" });
  const [unitModalError, setUnitModalError] = useState(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [confirmUnitId, setConfirmUnitId] = useState(null);
  const [pendingUnitToggleId, setPendingUnitToggleId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setStations(await listStations({ includeInactive: true }));
    } catch (err) {
      setLoadError(
        errorMessage(err, "Couldn't load stations. Check your connection and try again."),
      );
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
    setSavingStation(true);
    setStationModalError(null);
    try {
      const parsed = parseCoords(stationForm);
      if (!parsed.ok) {
        setStationModalError(parsed.error);
        return;
      }
      if (stationModal.mode === "add") {
        await createStation({
          id: stationForm.id.trim(),
          name: stationForm.name.trim(),
          category: stationForm.category,
          phone: stationForm.phone,
          coords: parsed.coords,
          estimatedTurnout: stationForm.estimatedTurnout,
        });
        flashOk("Station created.");
      } else {
        await updateStation(stationModal.station.id, {
          name: stationForm.name.trim(),
          category: stationForm.category,
          phone: stationForm.phone,
          coords: parsed.coords,
          estimatedTurnout: stationForm.estimatedTurnout,
        });
        flashOk("Station updated.");
      }
      setStationModal(null);
      await load();
    } catch (err) {
      setStationModalError(
        errorMessage(
          err,
          stationModal.mode === "add"
            ? "Couldn't create the station. Try again."
            : "Couldn't save the changes. Try again.",
        ),
      );
    } finally {
      setSavingStation(false);
    }
  };

  const handleSetStationActive = async (station, isActive) => {
    // One toggle at a time: a double-click must never fire a second
    // PATCH for the same (or another) row.
    if (pendingToggleId != null) return;
    setPendingToggleId(station.id);
    flashError(null);
    setBannerOk(null);
    try {
      await setStationActive(station.id, isActive);
      setConfirmStationId(null);
      flashOk(isActive ? "Station activated." : "Station deactivated.");
      await load();
    } catch (err) {
      setConfirmStationId(null);
      flashError(errorMessage(err, "Couldn't update the station status. Try again."));
    } finally {
      setPendingToggleId(null);
    }
  };

  const openAddUnit = (stationId) => {
    setUnitForm({ id: "", name: "" });
    setUnitModalError(null);
    setUnitModal({ mode: "add", stationId });
  };

  const openEditUnit = (stationId, unit) => {
    setUnitForm({ id: unit.id, name: unit.name });
    setUnitModalError(null);
    setUnitModal({ mode: "edit", stationId, unit });
  };

  const handleSaveUnit = async () => {
    setSavingUnit(true);
    setUnitModalError(null);
    try {
      if (unitModal.mode === "add") {
        await addUnit(unitModal.stationId, {
          id: unitForm.id.trim(),
          name: unitForm.name.trim(),
        });
        flashOk("Unit added.");
      } else {
        await updateUnit(unitModal.stationId, unitModal.unit.id, {
          name: unitForm.name.trim(),
        });
        flashOk("Unit updated.");
      }
      setUnitModal(null);
      await load();
    } catch (err) {
      setUnitModalError(
        errorMessage(
          err,
          unitModal.mode === "add"
            ? "Couldn't add the unit. Try again."
            : "Couldn't save the changes. Try again.",
        ),
      );
    } finally {
      setSavingUnit(false);
    }
  };

  const handleSetUnitActive = async (stationId, unit, isActive) => {
    if (pendingUnitToggleId != null) return;
    setPendingUnitToggleId(unit.id);
    setBannerOk(null);
    setBannerError(null);
    try {
      await setUnitActive(stationId, unit.id, isActive);
      setConfirmUnitId(null);
      flashOk(isActive ? "Unit activated." : "Unit deactivated.");
      await load();
    } catch (err) {
      setConfirmUnitId(null);
      flashError(errorMessage(err, "Couldn't update the unit status. Try again."));
    } finally {
      setPendingUnitToggleId(null);
    }
  };

  const unitsStation = unitsForStationId
    ? stations.find((s) => s.id === unitsForStationId)
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
                            onClick={() =>
                              setUnitsForStationId(
                                unitsForStationId === station.id ? null : station.id,
                              )
                            }
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                          >
                            {unitsForStationId === station.id ? "Hide Units" : "Units"}
                          </button>
                          <button
                            onClick={() => openEditStation(station)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                          >
                            Edit
                          </button>
                          {active ? (
                            confirmStationId === station.id ? (
                              <>
                                <button
                                  onClick={() => handleSetStationActive(station, false)}
                                  disabled={pendingToggleId != null}
                                  className="rounded-md border border-fire/40 bg-fire/10 px-2 py-1 text-xs font-semibold text-fire disabled:opacity-60"
                                >
                                  Confirm deactivate
                                </button>
                                <button
                                  onClick={() => setConfirmStationId(null)}
                                  disabled={pendingToggleId != null}
                                  className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmStationId(station.id)}
                                disabled={pendingToggleId != null}
                                className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-fire disabled:opacity-60"
                              >
                                Deactivate
                              </button>
                            )
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

        {/* Assigned-units panel for the selected station */}
        {unitsStation && (
          <section
            aria-label={`Assigned units for ${unitsStation.name}`}
            className="mt-6 rounded-lg border border-border bg-panel p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">
                  Assigned Units — {unitsStation.name}
                </h3>
                <p className="mt-1 font-mono text-xs text-ink-dim">{unitsStation.id}</p>
              </div>
              <button
                onClick={() => openAddUnit(unitsStation.id)}
                className="rounded-md bg-medical px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                Add Unit
              </button>
            </div>

            {normalizeUnits(unitsStation).length === 0 ? (
              <p className="mt-4 text-center text-sm text-ink-dim">
                No units assigned yet.
              </p>
            ) : (
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-dim">
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizeUnits(unitsStation).map((unit) => (
                    <tr key={unit.id} className="border-b border-border">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{unit.name}</div>
                        <div className="font-mono text-xs text-ink-dim">{unit.id}</div>
                      </td>
                      <td className="py-2.5 pr-3">{statusBadge(unit.isActive)}</td>
                      <td className="py-2.5 text-right">
                        <span className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditUnit(unitsStation.id, unit)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
                          >
                            Edit
                          </button>
                          {unit.isActive !== false ? (
                            confirmUnitId === unit.id ? (
                              <>
                                <button
                                  onClick={() =>
                                    handleSetUnitActive(unitsStation.id, unit, false)
                                  }
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
                              onClick={() =>
                                handleSetUnitActive(unitsStation.id, unit, true)
                              }
                              disabled={pendingUnitToggleId != null}
                              className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
                            >
                              Activate
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
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
        />
      )}

      {unitModal && (
        <UnitFormModal
          mode={unitModal.mode}
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
