/** Transcriptions supplied by the user, not a dosing engine. No doses are calculated. */
export const DEFAULT_NOTE =
  'La dosis de refuerzo se suma a la dosis fija indicada para esa comida. Si la HGT es menor de 80 mg/dL, no aplicar el bolo precomidas y avisar al equipo de salud.';
export function createSensitivityPreset() {
  return {
    ranges: ['≤140', '141–180', '181–220', '221–260', '261–300', '301–350', '351–400', '>400'],
    doses: [
      ['0', '0', '0'],
      ['0', '2', '4'],
      ['2', '4', '6'],
      ['4', '6', '8'],
      ['6', '8', '10'],
      ['8', '10', '12'],
      ['10', '12', '14'],
      ['12', '14', '16'],
    ],
    note: '',
  };
}
export function createBlankRapidProfile() {
  return {
    ranges: ['< 80', '80–149', '150–199', '200–249', '250–299', '300–349', '≥ 350'],
    doses: Array(7).fill(''),
    meals: ['Desayuno', 'Almuerzo', 'Once', 'Cena'],
    fixed: Array(4).fill(''),
    note: '',
    custom: '',
    useSensitivity: false,
    sensitivityView: 'all',
    sensitivity: createSensitivityPreset(),
  };
}
export function createApidraProfile() {
  return {
    ...createBlankRapidProfile(),
    doses: [
      'Omitir la dosis precomidas y avisar',
      '0 UI de refuerzo (solo dosis fija)',
      '+1 UI',
      '+2 UI',
      '+3 UI',
      '+4 UI',
      '+5 UI',
    ],
    fixed: ['4 UI', '4 UI', '2 UI', '4 UI'],
    note: DEFAULT_NOTE,
  };
}
export function createBasalProfile(insulinId) {
  return {
    times: ['AM', insulinId === 'nph' ? '22:00–23:00' : 'Noche'],
    doses: ['', ''],
    custom: '',
    frequency: '1',
  };
}
export function createInitialRegimen() {
  return {
    rapid: 'apidra',
    basal: 'none',
    rapidProfiles: { apidra: createApidraProfile() },
    basalProfiles: {},
    showCorrection: true,
    showFixed: true,
    showBasal: false,
  };
}
