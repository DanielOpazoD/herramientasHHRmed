import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialRegimen,
  createBasalProfile,
  createSensitivityPreset,
  createBlankRapidProfile,
  formatRegimenParagraph,
  normalizeRegimen,
  isValidRegimen,
  ProfileRepository,
  createMemoryStorage,
  decodeProfileFile,
  getPaperSettings,
  getPrintScale,
  createPaperCss,
} from '../src/index.js';
function basalRegimen() {
  const s = createInitialRegimen();
  s.basal = 'nph';
  s.showBasal = true;
  s.basalProfiles.nph = { ...createBasalProfile('nph'), frequency: '2', doses: ['12', '6 UI'] };
  return s;
}
function repo(options = {}) {
  let id = 0,
    time = 100;
  return new ProfileRepository({
    storage: createMemoryStorage(),
    clock: () => ++time,
    createId: () => `test-${++id}`,
    ...options,
  });
}
test('Apidra preserves the supplied fixed and correction doses', () => {
  const p = createInitialRegimen().rapidProfiles.apidra;
  assert.deepEqual(p.fixed, ['4 UI', '4 UI', '2 UI', '4 UI']);
  assert.deepEqual(p.doses, [
    'Omitir la dosis precomidas y avisar',
    '0 UI de refuerzo (solo dosis fija)',
    '+1 UI',
    '+2 UI',
    '+3 UI',
    '+4 UI',
    '+5 UI',
  ]);
});
test('fresh presets do not share mutable state', () => {
  const a = createInitialRegimen(),
    b = createInitialRegimen();
  a.rapidProfiles.apidra.sensitivity.doses[0][0] = '99';
  assert.equal(b.rapidProfiles.apidra.sensitivity.doses[0][0], '0');
});
test('the optional table preserves all 24 doses and the confirmed boundary', () => {
  const p = createSensitivityPreset();
  assert.equal(p.ranges[0], '≤140');
  assert.deepEqual(p.doses, [
    ['0', '0', '0'],
    ['0', '2', '4'],
    ['2', '4', '6'],
    ['4', '6', '8'],
    ['6', '8', '10'],
    ['8', '10', '12'],
    ['10', '12', '14'],
    ['12', '14', '16'],
  ]);
});
test('NPH has AM and 22:00–23:00 labels without invented doses', () => {
  const p = createBasalProfile('nph');
  assert.deepEqual(p.times, ['AM', '22:00–23:00']);
  assert.deepEqual(p.doses, ['', '']);
  assert.equal(createBasalProfile('glargine100').times[1], 'Noche');
});
test('other rapid insulins start without assigned doses', () => {
  const p = createBlankRapidProfile();
  assert(p.doses.every((v) => v === ''));
  assert(p.fixed.every((v) => v === ''));
});
test('legacy normalization preserves exact doses and concentration identifiers', () => {
  const s = basalRegimen();
  delete s.showBasal;
  delete s.rapidProfiles.apidra.sensitivity;
  delete s.basalProfiles.nph.frequency;
  s.rapid = 'humalog200';
  s.rapidProfiles.humalog200 = createBlankRapidProfile();
  s.rapidProfiles.humalog200.fixed[0] = '7 UI';
  const n = normalizeRegimen(s);
  assert.equal(n.rapid, 'humalog200');
  assert.equal(n.rapidProfiles.humalog200.fixed[0], '7 UI');
  assert.equal(n.basalProfiles.nph.frequency, '2');
  assert.equal(n.showBasal, true);
});
test('normalization strips patient identity and unknown fields at nested levels', () => {
  const s = createInitialRegimen();
  s.paciente = 'NO_EXPORTAR';
  s.rapidProfiles.apidra.rut = 'NO_EXPORTAR';
  s.rapidProfiles.apidra.sensitivity.paciente = 'NO_EXPORTAR';
  assert(!JSON.stringify(normalizeRegimen(s)).includes('NO_EXPORTAR'));
});
test('mismatched rows, invalid sensitivity and unknown IDs are rejected', () => {
  const a = createInitialRegimen();
  a.rapidProfiles.apidra.doses.pop();
  assert(!isValidRegimen(a));
  assert.throws(() => normalizeRegimen(a));
  const b = createInitialRegimen();
  b.rapidProfiles.apidra.sensitivityView = '3';
  assert(!isValidRegimen(b));
  const c = createInitialRegimen();
  c.rapid = 'constructor';
  assert(!isValidRegimen(c));
});
test('paragraph includes basal, corrections and meals, without strength suffixes', () => {
  const text = formatRegimenParagraph(basalRegimen());
  assert.match(text, /Insulina basal NPH, 2 veces al día: AM: 12 UI; 22:00–23:00: 6 UI/);
  assert.match(text, /HGT 150–199 mg\/dL: \+1 UI/);
  assert.match(text, /Desayuno: 4 UI; Almuerzo: 4 UI; Once: 2 UI; Cena: 4 UI/);
  assert(!/[\r\n]/.test(text));
  assert(!/U-100|U-300|UI\/mL|glulisina/i.test(text));
});
test('paragraph excludes hidden panels and adapts the standard note', () => {
  const s = basalRegimen();
  s.showFixed = false;
  let text = formatRegimenParagraph(s);
  assert(!text.includes('Dosis fija precomidas'));
  assert(!text.includes('se suma'));
  assert(!text.includes('solo dosis fija'));
  s.showCorrection = false;
  text = formatRegimenParagraph(s);
  assert(!text.includes('HGT'));
});
test('blank doses are unspecified, while zero is preserved', () => {
  const s = basalRegimen();
  s.basalProfiles.nph.doses = ['', '0'];
  const text = formatRegimenParagraph(s);
  assert.match(text, /AM: dosis no especificada/);
  assert.match(text, /22:00–23:00: 0 UI/);
});
test('a selected sensitivity exports only its own edited column', () => {
  const s = createInitialRegimen(),
    p = s.rapidProfiles.apidra;
  p.useSensitivity = true;
  p.sensitivityView = '1';
  p.sensitivity.doses[1][1] = '3';
  p.sensitivity.note = 'Nota\nde ejemplo';
  const text = formatRegimenParagraph(s);
  assert.match(text, /perfil normal/);
  assert.match(text, /HGT 141–180 mg\/dL: 3 UI/);
  assert(!text.includes('insulinosensible'));
  assert(!text.includes('insulinorresistente'));
  assert(!text.includes('\n'));
});
test('formatting does not mutate its input', () => {
  const s = createInitialRegimen(),
    before = JSON.stringify(s);
  formatRegimenParagraph(s);
  assert.equal(JSON.stringify(s), before);
});
test('profiles persist, autoload a default and return independent copies', () => {
  const storage = createMemoryStorage(),
    a = repo({ storage }),
    p = a.save('Basal', basalRegimen());
  a.setDefault(p.id);
  const b = repo({ storage });
  assert.equal(b.initialRegimen().basal, 'nph');
  b.get(p.id).regimen.basal = 'none';
  assert.equal(b.get(p.id).regimen.basal, 'nph');
});
test('updated default profiles use the latest saved doses', () => {
  const storage = createMemoryStorage(),
    a = repo({ storage }),
    p = a.save('Inicial', basalRegimen());
  a.setDefault(p.id);
  const s = basalRegimen();
  s.basalProfiles.nph.doses[0] = '14';
  a.save('Actualizado', s, { id: p.id });
  assert.equal(repo({ storage }).initialRegimen().basalProfiles.nph.doses[0], '14');
});
test('deletion tombstones prevent resurrection from old portable HTML', () => {
  const storage = createMemoryStorage(),
    a = repo({ storage }),
    p = a.save('Eliminar', basalRegimen());
  a.setDefault(p.id);
  const seed = a.list();
  a.remove(p.id);
  const b = repo({ storage, seed });
  assert.deepEqual(b.list(), []);
  assert.equal(b.getPreferences().defaultId, '');
});
test('explicit import restores a deleted profile and its default', () => {
  const a = repo(),
    p = a.save('Restaurar', basalRegimen());
  a.setDefault(p.id);
  const file = a.export();
  a.remove(p.id);
  assert.equal(a.import(file), 1);
  assert.equal(a.getPreferences().defaultId, p.id);
});
test('invalid imports are atomic', () => {
  const a = repo();
  a.save('Conservar', createInitialRegimen());
  const before = a.export();
  assert.throws(() => a.import('{bad'));
  assert.throws(() =>
    a.import(
      JSON.stringify({ format: 'hhr-insulin-profiles', version: 1, profiles: [{ id: 'bad' }] }),
    ),
  );
  assert.equal(a.export(), before);
});
test('future versions and duplicate identifiers are rejected', () => {
  const a = repo(),
    p = a.save('Perfil', createInitialRegimen());
  assert.throws(() =>
    decodeProfileFile(
      JSON.stringify({ format: 'hhr-insulin-profiles', version: 2, profiles: [p] }),
    ),
  );
  assert.throws(() =>
    decodeProfileFile(
      JSON.stringify({ format: 'hhr-insulin-profiles', version: 1, profiles: [p, p] }),
    ),
  );
});
test('storage failures preserve in-memory profiles and export', () => {
  const storage = {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    },
    a = repo({ storage });
  a.save('En memoria', createInitialRegimen());
  assert.equal(a.persistent, false);
  assert.equal(decodeProfileFile(a.export()).profiles.length, 1);
});
test('namespaces isolate libraries', () => {
  const storage = createMemoryStorage(),
    a = repo({ storage, namespace: 'a' });
  a.save('Solo A', createInitialRegimen());
  assert.deepEqual(repo({ storage, namespace: 'b' }).list(), []);
});
test('unknown identity fields are omitted from export', () => {
  const s = createInitialRegimen();
  s.paciente = 'NO_EXPORTAR';
  const a = repo();
  a.save('Perfil', s);
  assert(!a.export().includes('NO_EXPORTAR'));
});
test('Carta and A4 use actual dimensions and separate scale limits', () => {
  assert.equal(getPaperSettings('A4').contentWidthMm, 180);
  assert.equal(getPaperSettings('Letter').widthMm, 215.9);
  assert.equal(getPaperSettings('Letter').heightMm, 279.4);
  assert(getPrintScale(1200, 'Letter') < getPrintScale(1200, 'A4'));
  assert.equal(getPrintScale(600, 'A4'), 1);
  assert.match(createPaperCss('Letter'), /size:letter/);
  assert.throws(() => getPaperSettings('unknown'));
});
