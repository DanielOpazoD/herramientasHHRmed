import type { Regimen, Profile, StorageAdapter, Preferences } from '@hhr/insulin-core';
export interface PlannerOptions {
  initialRegimen?: Regimen;
  storage?: StorageAdapter | null;
  storageNamespace?: string;
  brand?: { logoSrc?: string; hospitalName?: string; hospitalSubtitle?: string };
  identity?: { paciente?: string; rut?: string; fecha?: string; prescriber?: string };
  savedSnapshot?: {
    regimen?: Regimen | null;
    profiles?: Profile[] | null;
    preferences?: Preferences | null;
  };
  getPortableBundle?: () => string | Promise<string>;
}
export interface PlannerHandle {
  getRegimen(): Regimen;
  setRegimen(regimen: Regimen): void;
  getText(): string;
  getProfiles(): Profile[];
  exportProfiles(): string;
  importProfiles(json: string): number;
  exportHtml(): Promise<string>;
  destroy(): void;
}
export function mountInsulinPlanner(root: HTMLElement, options?: PlannerOptions): PlannerHandle;
