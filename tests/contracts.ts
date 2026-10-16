import {
  createInitialRegimen,
  ProfileRepository,
  createMemoryStorage,
  formatRegimenParagraph,
  type Regimen,
} from '@hhr/insulin-core';
import { mountInsulinPlanner, type PlannerHandle } from '@hhr/insulin-planner';
const regimen: Regimen = createInitialRegimen();
const repository = new ProfileRepository({ storage: createMemoryStorage() });
const profile = repository.save('Plantilla', regimen);
repository.setDefault(profile.id);
const text: string = formatRegimenParagraph(repository.initialRegimen());
function mount(root: HTMLElement): PlannerHandle {
  return mountInsulinPlanner(root, { initialRegimen: regimen, storageNamespace: 'example' });
}
void text;
void mount;
// @ts-expect-error Unsupported paper sizes are rejected by the public contract.
repository.setPaperSize('Other');
