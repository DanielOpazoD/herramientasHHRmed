import { RAPID_INSULINS, BASAL_INSULINS, SENSITIVITY_NAMES } from './catalog.js';
import { DEFAULT_NOTE } from './presets.js';
import { normalizeRegimen } from './schema.js';
export function oneLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function doseText(value) {
  const text = oneLine(value);
  return text
    ? /^[+−-]?\d+(?:[.,]\d+)?$/.test(text)
      ? `${text} UI`
      : text
    : 'dosis no especificada';
}
export function getCurrentNote(state) {
  const p = state.rapidProfiles[state.rapid];
  if (p.useSensitivity) return p.sensitivity?.note ?? '';
  if (p.note === DEFAULT_NOTE) {
    if (state.showCorrection === false) return '';
    if (state.showFixed === false) return DEFAULT_NOTE.slice(DEFAULT_NOTE.indexOf('Si la HGT'));
  }
  return p.note;
}
/** Formatting only. Hidden sections are omitted, numeric units follow the table's UI heading. */
export function formatRegimenParagraph(input) {
  const state = normalizeRegimen(input),
    p = state.rapidProfiles[state.rapid],
    parts = [];
  const name =
    state.rapid === 'custom'
      ? oneLine(p.custom) || 'insulina para comidas no especificada'
      : RAPID_INSULINS[state.rapid].name;
  if (state.basal !== 'none' && state.showBasal) {
    const b = state.basalProfiles[state.basal],
      count = b.frequency === 'custom' ? b.times.length : Number(b.frequency);
    if (count) {
      const med =
        state.basal === 'custom'
          ? oneLine(b.custom) || 'insulina basal no especificada'
          : BASAL_INSULINS[state.basal].name;
      const frequency =
        b.frequency === '1'
          ? '1 vez al día'
          : b.frequency === '2'
            ? '2 veces al día'
            : 'horarios personalizados';
      const rows = Array.from(
        { length: count },
        (_, i) => `${oneLine(b.times[i]) || 'horario no especificado'}: ${doseText(b.doses[i])}`,
      );
      parts.push(`Insulina basal ${med}, ${frequency}: ${rows.join('; ')}`);
    }
  }
  if (state.showCorrection) {
    if (p.useSensitivity && p.sensitivity.ranges.length) {
      const columns = p.sensitivityView === 'all' ? [0, 1, 2] : [Number(p.sensitivityView)];
      const rows = p.sensitivity.ranges.map(
        (range, i) =>
          `HGT ${oneLine(range) || 'rango no especificado'} mg/dL: ${columns.map((c) => `${columns.length > 1 ? `${SENSITIVITY_NAMES[c].toLowerCase()} ` : ''}${doseText(p.sensitivity.doses[i][c])}`).join(', ')}`,
      );
      parts.push(
        `Corrección según sensibilidad con ${name}${columns.length === 1 ? ` (perfil ${SENSITIVITY_NAMES[columns[0]].toLowerCase()})` : ''}: ${rows.join('; ')}`,
      );
    } else if (!p.useSensitivity && p.ranges.length) {
      const rows = p.ranges.map(
        (range, i) =>
          `HGT ${oneLine(range) || 'rango no especificado'} mg/dL: ${doseText(!state.showFixed && p.doses[i] === '0 UI de refuerzo (solo dosis fija)' ? '0 UI de refuerzo' : p.doses[i])}`,
      );
      parts.push(`Refuerzo según HGT con ${name}: ${rows.join('; ')}`);
    }
  }
  if (state.showFixed && p.meals.length)
    parts.push(
      `Dosis fija precomidas de ${name}: ${p.meals.map((meal, i) => `${oneLine(meal) || 'horario no especificado'}: ${doseText(p.fixed[i])}`).join('; ')}`,
    );
  const note = oneLine(getCurrentNote(state));
  if (note) parts.push(note);
  return `Esquema de insulinoterapia: ${parts.length ? parts.map((text) => text.replace(/[.;\s]+$/, '')).join('. ') : 'sin cuadros activos con filas'}.`;
}
