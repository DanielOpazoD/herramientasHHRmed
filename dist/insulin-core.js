// packages/insulin-core/src/catalog.js
var RAPID_INSULINS = Object.freeze({
  apidra: Object.freeze({ name: "Apidra", ingredient: "glulisina", strength: 100 }),
  novorapid: Object.freeze({ name: "NovoRapid", ingredient: "aspart", strength: 100 }),
  humalog100: Object.freeze({ name: "Humalog", ingredient: "lispro", strength: 100 }),
  humalog200: Object.freeze({ name: "Humalog", ingredient: "lispro", strength: 200 }),
  fiasp: Object.freeze({ name: "Fiasp", ingredient: "aspart", strength: 100 }),
  regular: Object.freeze({ name: "Insulina regular", ingredient: "humana regular", strength: 100 }),
  custom: Object.freeze({ name: "Otra insulina", ingredient: "", strength: null })
});
var BASAL_INSULINS = Object.freeze({
  nph: Object.freeze({
    name: "NPH",
    ingredient: "humana is\xF3fana",
    strength: 100,
    action: "intermedia"
  }),
  glargine100: Object.freeze({
    name: "Lantus",
    ingredient: "glargina",
    strength: 100,
    action: "prolongada"
  }),
  glargine300: Object.freeze({
    name: "Toujeo",
    ingredient: "glargina",
    strength: 300,
    action: "prolongada"
  }),
  degludec100: Object.freeze({
    name: "Tresiba",
    ingredient: "degludec",
    strength: 100,
    action: "ultralarga"
  }),
  degludec200: Object.freeze({
    name: "Tresiba",
    ingredient: "degludec",
    strength: 200,
    action: "ultralarga"
  }),
  detemir: Object.freeze({
    name: "Levemir",
    ingredient: "detemir",
    strength: 100,
    action: "prolongada"
  }),
  custom: Object.freeze({
    name: "Otra insulina basal",
    ingredient: "",
    strength: null,
    action: ""
  })
});
var SENSITIVITY_NAMES = Object.freeze([
  "Insulinosensible",
  "Normal",
  "Insulinorresistente"
]);
var PAPER_SIZES = Object.freeze({
  A4: Object.freeze({ name: "A4", cssName: "A4", widthMm: 210, heightMm: 297 }),
  Letter: Object.freeze({ name: "Carta", cssName: "letter", widthMm: 215.9, heightMm: 279.4 })
});

// packages/insulin-core/src/presets.js
var DEFAULT_NOTE = "La dosis de refuerzo se suma a la dosis fija indicada para esa comida. Si la HGT es menor de 80 mg/dL, no aplicar el bolo precomidas y avisar al equipo de salud.";
function createSensitivityPreset() {
  return {
    ranges: ["\u2264140", "141\u2013180", "181\u2013220", "221\u2013260", "261\u2013300", "301\u2013350", "351\u2013400", ">400"],
    doses: [
      ["0", "0", "0"],
      ["0", "2", "4"],
      ["2", "4", "6"],
      ["4", "6", "8"],
      ["6", "8", "10"],
      ["8", "10", "12"],
      ["10", "12", "14"],
      ["12", "14", "16"]
    ],
    note: ""
  };
}
function createBlankRapidProfile() {
  return {
    ranges: ["< 80", "80\u2013149", "150\u2013199", "200\u2013249", "250\u2013299", "300\u2013349", "\u2265 350"],
    doses: Array(7).fill(""),
    meals: ["Desayuno", "Almuerzo", "Once", "Cena"],
    fixed: Array(4).fill(""),
    note: "",
    custom: "",
    useSensitivity: false,
    sensitivityView: "all",
    sensitivity: createSensitivityPreset()
  };
}
function createApidraProfile() {
  return {
    ...createBlankRapidProfile(),
    doses: [
      "Omitir la dosis precomidas y avisar",
      "0 UI de refuerzo (solo dosis fija)",
      "+1 UI",
      "+2 UI",
      "+3 UI",
      "+4 UI",
      "+5 UI"
    ],
    fixed: ["4 UI", "4 UI", "2 UI", "4 UI"],
    note: DEFAULT_NOTE
  };
}
function createBasalProfile(insulinId) {
  return {
    times: ["AM", insulinId === "nph" ? "22:00\u201323:00" : "Noche"],
    doses: ["", ""],
    custom: "",
    frequency: "1"
  };
}
function createInitialRegimen() {
  return {
    rapid: "apidra",
    basal: "none",
    rapidProfiles: { apidra: createApidraProfile() },
    basalProfiles: {},
    showCorrection: true,
    showFixed: true,
    showBasal: false
  };
}

// packages/insulin-core/src/schema.js
var SCHEMA_VERSION = 1;
var LIMITS = Object.freeze({
  maxRows: 200,
  maxProfiles: 500,
  maxTextLength: 5e3,
  maxImportBytes: 2 * 1024 * 1024
});
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value, max = LIMITS.maxTextLength) {
  return typeof value === "string" && value.length <= max;
}
function strings(value) {
  return Array.isArray(value) && value.length <= LIMITS.maxRows && value.every((v) => text(v));
}
function flag(value) {
  return value === void 0 || typeof value === "boolean";
}
function isValidRegimen(value) {
  if (!object(value) || !Object.hasOwn(RAPID_INSULINS, value.rapid) || !(value.basal === "none" || Object.hasOwn(BASAL_INSULINS, value.basal)) || !object(value.rapidProfiles) || !object(value.basalProfiles))
    return false;
  if (!["showCorrection", "showFixed", "showBasal"].every((key) => flag(value[key]))) return false;
  for (const [key, p] of Object.entries(value.rapidProfiles)) {
    if (!Object.hasOwn(RAPID_INSULINS, key) || !object(p) || !strings(p.ranges) || !strings(p.doses) || p.ranges.length !== p.doses.length || !strings(p.meals) || !strings(p.fixed) || p.meals.length !== p.fixed.length || !text(p.note) || !text(p.custom) || !flag(p.useSensitivity))
      return false;
    if (p.sensitivityView !== void 0 && !["all", "0", "1", "2"].includes(p.sensitivityView))
      return false;
    if (p.sensitivity !== void 0) {
      const t = p.sensitivity;
      if (!object(t) || !strings(t.ranges) || !Array.isArray(t.doses) || t.ranges.length !== t.doses.length || !t.doses.every((d) => strings(d) && d.length === 3) || !text(t.note))
        return false;
    }
  }
  for (const [key, b] of Object.entries(value.basalProfiles)) {
    if (!Object.hasOwn(BASAL_INSULINS, key) || !object(b) || !strings(b.times) || !strings(b.doses) || b.times.length !== b.doses.length || !text(b.custom) || b.frequency !== void 0 && !["1", "2", "custom"].includes(b.frequency))
      return false;
  }
  return Object.hasOwn(value.rapidProfiles, value.rapid) && (value.basal === "none" || Object.hasOwn(value.basalProfiles, value.basal));
}
function normalizeRegimen(value) {
  if (!isValidRegimen(value)) throw new TypeError("Esquema de insulina inv\xE1lido.");
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
        sensitivityView: p.sensitivityView ?? "all",
        sensitivity: p.sensitivity ? {
          ranges: [...p.sensitivity.ranges],
          doses: p.sensitivity.doses.map((d) => [...d]),
          note: p.sensitivity.note
        } : createSensitivityPreset()
      }
    ])
  );
  const basalProfiles = Object.fromEntries(
    Object.entries(value.basalProfiles).map(([id, b]) => [
      id,
      {
        times: [...b.times],
        doses: [...b.doses],
        custom: b.custom,
        frequency: b.frequency ?? (b.times.length === 1 ? "1" : b.times.length === 2 ? "2" : "custom")
      }
    ])
  );
  return {
    rapid: value.rapid,
    basal: value.basal,
    rapidProfiles,
    basalProfiles,
    showCorrection: value.showCorrection ?? true,
    showFixed: value.showFixed ?? true,
    showBasal: value.showBasal ?? value.basal !== "none"
  };
}
function isValidProfile(item) {
  return object(item) && text(item.id, 100) && item.id.length > 0 && text(item.name, 80) && item.name.trim().length > 0 && (item.updated === void 0 || Number.isFinite(item.updated) && item.updated >= 0) && isValidRegimen(item.regimen);
}
function normalizeProfile(item) {
  if (!isValidProfile(item)) throw new TypeError("Perfil de insulina inv\xE1lido.");
  return {
    id: item.id,
    name: item.name.trim(),
    updated: item.updated ?? 0,
    regimen: normalizeRegimen(item.regimen)
  };
}
function isValidPreferences(p) {
  return object(p) && text(p.defaultId, 100) && Object.hasOwn(PAPER_SIZES, p.paperSize) && Number.isFinite(p.updated) && p.updated >= 0;
}
function normalizePreferences(p) {
  return isValidPreferences(p) ? { defaultId: p.defaultId, paperSize: p.paperSize, updated: p.updated } : { defaultId: "", paperSize: "A4", updated: 0 };
}
function decodeProfileFile(json) {
  if (typeof json !== "string" || new TextEncoder().encode(json).length > LIMITS.maxImportBytes)
    throw new TypeError("Archivo demasiado grande.");
  const data = JSON.parse(json);
  if (!object(data) || data.format !== "hhr-insulin-profiles" || data.version !== SCHEMA_VERSION || !Array.isArray(data.profiles) || data.profiles.length > LIMITS.maxProfiles || !data.profiles.every(isValidProfile))
    throw new TypeError("Archivo de perfiles HHR inv\xE1lido.");
  const profiles = data.profiles.map(normalizeProfile);
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
    throw new TypeError("El archivo contiene identificadores duplicados.");
  return {
    format: data.format,
    version: SCHEMA_VERSION,
    profiles,
    defaultId: typeof data.defaultId === "string" ? data.defaultId : ""
  };
}

// packages/insulin-core/src/text.js
function oneLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
function doseText(value) {
  const text2 = oneLine(value);
  return text2 ? /^[+−-]?\d+(?:[.,]\d+)?$/.test(text2) ? `${text2} UI` : text2 : "dosis no especificada";
}
function getCurrentNote(state) {
  const p = state.rapidProfiles[state.rapid];
  if (p.useSensitivity) return p.sensitivity?.note ?? "";
  if (p.note === DEFAULT_NOTE) {
    if (state.showCorrection === false) return "";
    if (state.showFixed === false) return DEFAULT_NOTE.slice(DEFAULT_NOTE.indexOf("Si la HGT"));
  }
  return p.note;
}
function formatRegimenParagraph(input) {
  const state = normalizeRegimen(input), p = state.rapidProfiles[state.rapid], parts = [];
  const name = state.rapid === "custom" ? oneLine(p.custom) || "insulina para comidas no especificada" : RAPID_INSULINS[state.rapid].name;
  if (state.basal !== "none" && state.showBasal) {
    const b = state.basalProfiles[state.basal], count = b.frequency === "custom" ? b.times.length : Number(b.frequency);
    if (count) {
      const med = state.basal === "custom" ? oneLine(b.custom) || "insulina basal no especificada" : BASAL_INSULINS[state.basal].name;
      const frequency = b.frequency === "1" ? "1 vez al d\xEDa" : b.frequency === "2" ? "2 veces al d\xEDa" : "horarios personalizados";
      const rows = Array.from(
        { length: count },
        (_, i) => `${oneLine(b.times[i]) || "horario no especificado"}: ${doseText(b.doses[i])}`
      );
      parts.push(`Insulina basal ${med}, ${frequency}: ${rows.join("; ")}`);
    }
  }
  if (state.showCorrection) {
    if (p.useSensitivity && p.sensitivity.ranges.length) {
      const columns = p.sensitivityView === "all" ? [0, 1, 2] : [Number(p.sensitivityView)];
      const rows = p.sensitivity.ranges.map(
        (range, i) => `HGT ${oneLine(range) || "rango no especificado"} mg/dL: ${columns.map((c) => `${columns.length > 1 ? `${SENSITIVITY_NAMES[c].toLowerCase()} ` : ""}${doseText(p.sensitivity.doses[i][c])}`).join(", ")}`
      );
      parts.push(
        `Correcci\xF3n seg\xFAn sensibilidad con ${name}${columns.length === 1 ? ` (perfil ${SENSITIVITY_NAMES[columns[0]].toLowerCase()})` : ""}: ${rows.join("; ")}`
      );
    } else if (!p.useSensitivity && p.ranges.length) {
      const rows = p.ranges.map(
        (range, i) => `HGT ${oneLine(range) || "rango no especificado"} mg/dL: ${doseText(!state.showFixed && p.doses[i] === "0 UI de refuerzo (solo dosis fija)" ? "0 UI de refuerzo" : p.doses[i])}`
      );
      parts.push(`Refuerzo seg\xFAn HGT con ${name}: ${rows.join("; ")}`);
    }
  }
  if (state.showFixed && p.meals.length)
    parts.push(
      `Dosis fija precomidas de ${name}: ${p.meals.map((meal, i) => `${oneLine(meal) || "horario no especificado"}: ${doseText(p.fixed[i])}`).join("; ")}`
    );
  const note = oneLine(getCurrentNote(state));
  if (note) parts.push(note);
  return `Esquema de insulinoterapia: ${parts.length ? parts.map((text2) => text2.replace(/[.;\s]+$/, "")).join(". ") : "sin cuadros activos con filas"}.`;
}

// packages/insulin-core/src/paper.js
function getPaperSettings(size = "A4") {
  if (!Object.hasOwn(PAPER_SIZES, size)) throw new TypeError("Formato de papel inv\xE1lido.");
  const paper = PAPER_SIZES[size];
  return { ...paper, contentWidthMm: paper.widthMm - 30, contentHeightMm: paper.heightMm - 22 };
}
function getPrintScale(heightPx, size = "A4") {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return 1;
  return Math.min(1, (getPaperSettings(size).contentHeightMm - 1) * 96 / 25.4 / heightPx);
}
function createPaperCss(size = "A4") {
  const paper = getPaperSettings(size);
  return `@page{size:${paper.cssName};margin:12mm 15mm 10mm}@media print{.hhr-insulin .sheet{width:${paper.contentWidthMm}mm}}`;
}

// packages/insulin-core/src/profiles.js
function createMemoryStorage() {
  const values = /* @__PURE__ */ new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}
function read(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value === null || value === void 0 ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
var ProfileRepository = class {
  constructor({
    storage = null,
    namespace = "hhr-insulin-profiles-v1",
    seed = [],
    preferences = null,
    clock = Date.now,
    createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  } = {}) {
    this.storage = storage;
    this.namespace = namespace;
    this.clock = clock;
    this.createId = createId;
    this.persistent = false;
    const removed = read(storage, `${namespace}-removed`, {});
    this.removed = removed && typeof removed === "object" && !Array.isArray(removed) ? Object.fromEntries(Object.entries(removed).filter(([, v]) => Number.isFinite(v))) : {};
    const profiles = /* @__PURE__ */ new Map();
    const stored = read(storage, namespace, []);
    for (const list of [seed, stored]) {
      if (!Array.isArray(list)) continue;
      for (const item of list.slice(0, LIMITS.maxProfiles)) {
        if (!isValidProfile(item)) continue;
        const p = normalizeProfile(item), previous = profiles.get(p.id);
        if (!previous || p.updated > previous.updated) profiles.set(p.id, p);
      }
    }
    this.profiles = [...profiles.values()].filter(
      (p) => !(Number(this.removed[p.id]) >= p.updated)
    );
    const embedded = normalizePreferences(preferences), local = read(storage, `${namespace}-preferences`, null);
    this.preferences = isValidPreferences(local) && local.updated >= embedded.updated ? normalizePreferences(local) : embedded;
    if (!this.profiles.some((p) => p.id === this.preferences.defaultId))
      this.preferences.defaultId = "";
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
    if (id && !this.profiles.some((p2) => p2.id === id)) throw new RangeError("Perfil inexistente.");
    if (!id && this.profiles.length >= LIMITS.maxProfiles)
      throw new RangeError("Se alcanz\xF3 el m\xE1ximo de perfiles.");
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
      this.preferences.defaultId = "";
      this.preferences.updated = this.clock();
    }
    this.persist();
    return true;
  }
  setDefault(id = "") {
    if (id && !this.profiles.some((p) => p.id === id)) throw new RangeError("Perfil inexistente.");
    this.preferences.defaultId = id;
    this.preferences.updated = this.clock();
    this.persist();
  }
  setPaperSize(size) {
    const next = { ...this.preferences, paperSize: size, updated: this.clock() };
    if (!isValidPreferences(next)) throw new TypeError("Formato de papel inv\xE1lido.");
    this.preferences = next;
    this.persist();
  }
  initialRegimen(fallback = createInitialRegimen()) {
    return this.get(this.preferences.defaultId)?.regimen ?? normalizeProfile({ id: "fallback", name: "Fallback", regimen: fallback }).regimen;
  }
  export() {
    return JSON.stringify(
      {
        format: "hhr-insulin-profiles",
        version: SCHEMA_VERSION,
        profiles: this.list(),
        defaultId: this.preferences.defaultId
      },
      null,
      2
    );
  }
  import(json) {
    const data = decodeProfileFile(json), next = new Map(this.profiles.map((p) => [p.id, p]));
    for (const p of data.profiles) {
      const old = next.get(p.id);
      if (!old || p.updated > old.updated) next.set(p.id, p);
    }
    if (next.size > LIMITS.maxProfiles) throw new RangeError("Se alcanz\xF3 el m\xE1ximo de perfiles.");
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
      if (!this.storage) throw new Error("No storage");
      this.storage.setItem(this.namespace, JSON.stringify(this.profiles));
      this.storage.setItem(`${this.namespace}-removed`, JSON.stringify(this.removed));
      this.storage.setItem(`${this.namespace}-preferences`, JSON.stringify(this.preferences));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    return this.persistent;
  }
};
export {
  BASAL_INSULINS,
  DEFAULT_NOTE,
  LIMITS,
  PAPER_SIZES,
  ProfileRepository,
  RAPID_INSULINS,
  SCHEMA_VERSION,
  SENSITIVITY_NAMES,
  clone,
  createApidraProfile,
  createBasalProfile,
  createBlankRapidProfile,
  createInitialRegimen,
  createMemoryStorage,
  createPaperCss,
  createSensitivityPreset,
  decodeProfileFile,
  doseText,
  formatRegimenParagraph,
  getCurrentNote,
  getPaperSettings,
  getPrintScale,
  isValidPreferences,
  isValidProfile,
  isValidRegimen,
  normalizePreferences,
  normalizeProfile,
  normalizeRegimen,
  oneLine
};
