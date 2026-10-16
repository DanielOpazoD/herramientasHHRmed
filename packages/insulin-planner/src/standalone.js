import { mountInsulinPlanner } from './index.js';
const root = document.querySelector('.hhr-insulin');
// Capture the saved snapshot before mount replaces the static template.
const read = (id) => {
  try {
    return JSON.parse(root.querySelector('#' + id)?.textContent ?? 'null');
  } catch {
    return null;
  }
};
const saved = {
  regimen: read('savedState'),
  profiles: read('savedProfiles'),
  preferences: read('savedPreferences'),
};
const identity = Object.fromEntries(
  ['paciente', 'rut', 'fecha', 'prescriber'].map((id) => [
    id,
    root.querySelector('#' + id)?.value ?? '',
  ]),
);
const brand = {
  logoSrc: root.querySelector('#logoImage')?.getAttribute('src'),
  hospitalName: root.querySelector('.hospital-name')?.textContent,
  hospitalSubtitle: root.querySelector('.hospital-sub')?.textContent,
};
mountInsulinPlanner(root, {
  savedSnapshot: saved,
  identity,
  brand,
  getPortableBundle: () => document.querySelector('script[data-hhr-bundle]').textContent,
});
