import {
  clone,
  normalizeProfile,
  normalizePreferences,
  isValidProfile,
  isValidPreferences,
  decodeProfileFile,
  LIMITS,
  SCHEMA_VERSION,
} from './schema.js';
import { createInitialRegimen } from './presets.js';

/** localStorage-compatible adapter for tests, Node.js, and applications without a browser. */
export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
function read(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value === null || value === undefined ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
/** Regimens only: identity is intentionally not part of this repository's data model. */
export class ProfileRepository {
  constructor({
    storage = null,
    namespace = 'hhr-insulin-profiles-v1',
    seed = [],
    preferences = null,
    clock = Date.now,
    createId = () =>
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  } = {}) {
    this.storage = storage;
    this.namespace = namespace;
    this.clock = clock;
    this.createId = createId;
    this.persistent = false;
    const removed = read(storage, `${namespace}-removed`, {});
    this.removed =
      removed && typeof removed === 'object' && !Array.isArray(removed)
        ? Object.fromEntries(Object.entries(removed).filter(([, v]) => Number.isFinite(v)))
        : {};
    const profiles = new Map();
    const stored = read(storage, namespace, []);
    for (const list of [seed, stored]) {
      if (!Array.isArray(list)) continue;
      for (const item of list.slice(0, LIMITS.maxProfiles)) {
        if (!isValidProfile(item)) continue;
        const p = normalizeProfile(item),
          previous = profiles.get(p.id);
        if (!previous || p.updated > previous.updated) profiles.set(p.id, p);
      }
    }
    this.profiles = [...profiles.values()].filter(
      (p) => !(Number(this.removed[p.id]) >= p.updated),
    );
    const embedded = normalizePreferences(preferences),
      local = read(storage, `${namespace}-preferences`, null);
    this.preferences =
      isValidPreferences(local) && local.updated >= embedded.updated
        ? normalizePreferences(local)
        : embedded;
    if (!this.profiles.some((p) => p.id === this.preferences.defaultId))
      this.preferences.defaultId = '';
  }
  list() {
    return clone(this.profiles);
  }
  get(id) {
    const p = this.profiles.find((item) => item.id === id);
    return p ? clone(p) : null;
  }
  getPreferences() {
    return clone(this.preferences);
  }
  save(name, regimen, { id } = {}) {
    if (id && !this.profiles.some((p) => p.id === id)) throw new RangeError('Perfil inexistente.');
    if (!id && this.profiles.length >= LIMITS.maxProfiles)
      throw new RangeError('Se alcanzó el máximo de perfiles.');
    const p = normalizeProfile({ id: id ?? this.createId(), name, updated: this.clock(), regimen });
    const index = this.profiles.findIndex((item) => item.id === p.id);
    if (index < 0) this.profiles.push(p);
    else this.profiles[index] = p;
    delete this.removed[p.id];
    this.persist();
    return clone(p);
  }
  remove(id) {
    if (!this.profiles.some((p) => p.id === id)) return false;
    this.profiles = this.profiles.filter((p) => p.id !== id);
    this.removed[id] = this.clock();
    if (this.preferences.defaultId === id) {
      this.preferences.defaultId = '';
      this.preferences.updated = this.clock();
    }
    this.persist();
    return true;
  }
  setDefault(id = '') {
    if (id && !this.profiles.some((p) => p.id === id)) throw new RangeError('Perfil inexistente.');
    this.preferences.defaultId = id;
    this.preferences.updated = this.clock();
    this.persist();
  }
  setPaperSize(size) {
    const next = { ...this.preferences, paperSize: size, updated: this.clock() };
    if (!isValidPreferences(next)) throw new TypeError('Formato de papel inválido.');
    this.preferences = next;
    this.persist();
  }
  initialRegimen(fallback = createInitialRegimen()) {
    return (
      this.get(this.preferences.defaultId)?.regimen ??
      normalizeProfile({ id: 'fallback', name: 'Fallback', regimen: fallback }).regimen
    );
  }
  export() {
    return JSON.stringify(
      {
        format: 'hhr-insulin-profiles',
        version: SCHEMA_VERSION,
        profiles: this.list(),
        defaultId: this.preferences.defaultId,
      },
      null,
      2,
    );
  }
  import(json) {
    // Parse and validate the entire file before changing memory or storage.
    const data = decodeProfileFile(json),
      next = new Map(this.profiles.map((p) => [p.id, p]));
    for (const p of data.profiles) {
      const old = next.get(p.id);
      if (!old || p.updated > old.updated) next.set(p.id, p);
    }
    if (next.size > LIMITS.maxProfiles) throw new RangeError('Se alcanzó el máximo de perfiles.');
    this.profiles = [...next.values()];
    for (const p of data.profiles) delete this.removed[p.id];
    if (data.defaultId && next.has(data.defaultId)) {
      this.preferences.defaultId = data.defaultId;
      this.preferences.updated = this.clock();
    }
    this.persist();
    return data.profiles.length;
  }
  persist() {
    try {
      if (!this.storage) throw new Error('No storage');
      this.storage.setItem(this.namespace, JSON.stringify(this.profiles));
      this.storage.setItem(`${this.namespace}-removed`, JSON.stringify(this.removed));
      this.storage.setItem(`${this.namespace}-preferences`, JSON.stringify(this.preferences));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    return this.persistent;
  }
}
