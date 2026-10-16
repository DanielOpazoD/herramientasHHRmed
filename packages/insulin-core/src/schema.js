import { RAPID_INSULINS, BASAL_INSULINS, PAPER_SIZES } from './catalog.js';
import { createSensitivityPreset } from './presets.js';
export const SCHEMA_VERSION = 1;
export const LIMITS = Object.freeze({
  maxRows: 200,
  maxProfiles: 500,
  maxTextLength: 5000,
  maxImportBytes: 2 * 1024 * 1024,
});
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value, max = LIMITS.maxTextLength) {
  return typeof value === 'string' && value.length <= max;
}
function strings(value) {
  return Array.isArray(value) && value.length <= LIMITS.maxRows && value.every((v) => text(v));
}
function flag(value) {
  return value === undefined || typeof value === 'boolean';
}
export function isValidRegimen(value) {
  if (
    !object(value) ||
    !Object.hasOwn(RAPID_INSULINS, value.rapid) ||
    !(value.basal === 'none' || Object.hasOwn(BASAL_INSULINS, value.basal)) ||
    !object(value.rapidProfiles) ||
    !object(value.basalProfiles)
  )
    return false;
  if (!['showCorrection', 'showFixed', 'showBasal'].every((key) => flag(value[key]))) return false;
  for (const [key, p] of Object.entries(value.rapidProfiles)) {
    if (
      !Object.hasOwn(RAPID_INSULINS, key) ||
      !object(p) ||
      !strings(p.ranges) ||
      !strings(p.doses) ||
      p.ranges.length !== p.doses.length ||
      !strings(p.meals) ||
      !strings(p.fixed) ||
      p.meals.length !== p.fixed.length ||
      !text(p.note) ||
      !text(p.custom) ||
      !flag(p.useSensitivity)
    )
      return false;
    if (p.sensitivityView !== undefined && !['all', '0', '1', '2'].includes(p.sensitivityView))
      return false;
    if (p.sensitivity !== undefined) {
      const t = p.sensitivity;
      if (
        !object(t) ||
        !strings(t.ranges) ||
        !Array.isArray(t.doses) ||
        t.ranges.length !== t.doses.length ||
        !t.doses.every((d) => strings(d) && d.length === 3) ||
        !text(t.note)
      )
        return false;
    }
  }
  for (const [key, b] of Object.entries(value.basalProfiles)) {
    if (
      !Object.hasOwn(BASAL_INSULINS, key) ||
      !object(b) ||
      !strings(b.times) ||
      !strings(b.doses) ||
      b.times.length !== b.doses.length ||
      !text(b.custom) ||
      (b.frequency !== undefined && !['1', '2', 'custom'].includes(b.frequency))
    )
      return false;
  }
  return (
    Object.hasOwn(value.rapidProfiles, value.rapid) &&
    (value.basal === 'none' || Object.hasOwn(value.basalProfiles, value.basal))
  );
}
/** Whitelist fields: patient identity and unknown keys never enter a reusable profile. */
export function normalizeRegimen(value) {
  if (!isValidRegimen(value)) throw new TypeError('Esquema de insulina inválido.');
  const rapidProfiles = Object.fromEntries(
    Object.entries(value.rapidProfiles).map(([id, p]) => [
      id,
      {
        ranges: [...p.ranges],
        doses: [...p.doses],
        meals: [...p.meals],
        fixed: [...p.fixed],
        note: p.note,
        custom: p.custom,
        useSensitivity: p.useSensitivity ?? false,
        sensitivityView: p.sensitivityView ?? 'all',
        sensitivity: p.sensitivity
          ? {
              ranges: [...p.sensitivity.ranges],
              doses: p.sensitivity.doses.map((d) => [...d]),
              note: p.sensitivity.note,
            }
          : createSensitivityPreset(),
      },
    ]),
  );
  const basalProfiles = Object.fromEntries(
    Object.entries(value.basalProfiles).map(([id, b]) => [
      id,
      {
        times: [...b.times],
        doses: [...b.doses],
        custom: b.custom,
        frequency:
          b.frequency ?? (b.times.length === 1 ? '1' : b.times.length === 2 ? '2' : 'custom'),
      },
    ]),
  );
  return {
    rapid: value.rapid,
    basal: value.basal,
    rapidProfiles,
    basalProfiles,
    showCorrection: value.showCorrection ?? true,
    showFixed: value.showFixed ?? true,
    showBasal: value.showBasal ?? value.basal !== 'none',
  };
}
export function isValidProfile(item) {
  return (
    object(item) &&
    text(item.id, 100) &&
    item.id.length > 0 &&
    text(item.name, 80) &&
    item.name.trim().length > 0 &&
    (item.updated === undefined || (Number.isFinite(item.updated) && item.updated >= 0)) &&
    isValidRegimen(item.regimen)
  );
}
export function normalizeProfile(item) {
  if (!isValidProfile(item)) throw new TypeError('Perfil de insulina inválido.');
  return {
    id: item.id,
    name: item.name.trim(),
    updated: item.updated ?? 0,
    regimen: normalizeRegimen(item.regimen),
  };
}
export function isValidPreferences(p) {
  return (
    object(p) &&
    text(p.defaultId, 100) &&
    Object.hasOwn(PAPER_SIZES, p.paperSize) &&
    Number.isFinite(p.updated) &&
    p.updated >= 0
  );
}
export function normalizePreferences(p) {
  return isValidPreferences(p)
    ? { defaultId: p.defaultId, paperSize: p.paperSize, updated: p.updated }
    : { defaultId: '', paperSize: 'A4', updated: 0 };
}
export function decodeProfileFile(json) {
  if (typeof json !== 'string' || new TextEncoder().encode(json).length > LIMITS.maxImportBytes)
    throw new TypeError('Archivo demasiado grande.');
  const data = JSON.parse(json);
  if (
    !object(data) ||
    data.format !== 'hhr-insulin-profiles' ||
    data.version !== SCHEMA_VERSION ||
    !Array.isArray(data.profiles) ||
    data.profiles.length > LIMITS.maxProfiles ||
    !data.profiles.every(isValidProfile)
  )
    throw new TypeError('Archivo de perfiles HHR inválido.');
  const profiles = data.profiles.map(normalizeProfile);
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
    throw new TypeError('El archivo contiene identificadores duplicados.');
  return {
    format: data.format,
    version: SCHEMA_VERSION,
    profiles,
    defaultId: typeof data.defaultId === 'string' ? data.defaultId : '',
  };
}
