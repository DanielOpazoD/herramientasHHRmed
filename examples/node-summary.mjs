import {
  createInitialRegimen,
  createBasalProfile,
  formatRegimenParagraph,
} from '@hhr/insulin-core';
// Datos sintéticos: ejemplo de integración y formato, no una pauta de un paciente.
const regimen = createInitialRegimen();
regimen.basal = 'nph';
regimen.showBasal = true;
regimen.basalProfiles.nph = {
  ...createBasalProfile('nph'),
  frequency: '2',
  doses: ['12 UI', '6 UI'],
};
console.log(formatRegimenParagraph(regimen));
