/** Stable identifiers preserve compatibility with previously exported HHR profiles. */
export const RAPID_INSULINS = Object.freeze({
  apidra: Object.freeze({ name: 'Apidra', ingredient: 'glulisina', strength: 100 }),
  novorapid: Object.freeze({ name: 'NovoRapid', ingredient: 'aspart', strength: 100 }),
  humalog100: Object.freeze({ name: 'Humalog', ingredient: 'lispro', strength: 100 }),
  humalog200: Object.freeze({ name: 'Humalog', ingredient: 'lispro', strength: 200 }),
  fiasp: Object.freeze({ name: 'Fiasp', ingredient: 'aspart', strength: 100 }),
  regular: Object.freeze({ name: 'Insulina regular', ingredient: 'humana regular', strength: 100 }),
  custom: Object.freeze({ name: 'Otra insulina', ingredient: '', strength: null }),
});
export const BASAL_INSULINS = Object.freeze({
  nph: Object.freeze({
    name: 'NPH',
    ingredient: 'humana isófana',
    strength: 100,
    action: 'intermedia',
  }),
  glargine100: Object.freeze({
    name: 'Lantus',
    ingredient: 'glargina',
    strength: 100,
    action: 'prolongada',
  }),
  glargine300: Object.freeze({
    name: 'Toujeo',
    ingredient: 'glargina',
    strength: 300,
    action: 'prolongada',
  }),
  degludec100: Object.freeze({
    name: 'Tresiba',
    ingredient: 'degludec',
    strength: 100,
    action: 'ultralarga',
  }),
  degludec200: Object.freeze({
    name: 'Tresiba',
    ingredient: 'degludec',
    strength: 200,
    action: 'ultralarga',
  }),
  detemir: Object.freeze({
    name: 'Levemir',
    ingredient: 'detemir',
    strength: 100,
    action: 'prolongada',
  }),
  custom: Object.freeze({
    name: 'Otra insulina basal',
    ingredient: '',
    strength: null,
    action: '',
  }),
});
export const SENSITIVITY_NAMES = Object.freeze([
  'Insulinosensible',
  'Normal',
  'Insulinorresistente',
]);
export const PAPER_SIZES = Object.freeze({
  A4: Object.freeze({ name: 'A4', cssName: 'A4', widthMm: 210, heightMm: 297 }),
  Letter: Object.freeze({ name: 'Carta', cssName: 'letter', widthMm: 215.9, heightMm: 279.4 }),
});
