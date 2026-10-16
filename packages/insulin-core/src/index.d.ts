export type RapidId =
  | 'apidra'
  | 'novorapid'
  | 'humalog100'
  | 'humalog200'
  | 'fiasp'
  | 'regular'
  | 'custom';
export type BasalId =
  | 'nph'
  | 'glargine100'
  | 'glargine300'
  | 'degludec100'
  | 'degludec200'
  | 'detemir'
  | 'custom';
export type PaperSize = 'A4' | 'Letter';
export type SensitivityView = 'all' | '0' | '1' | '2';
export interface SensitivityProfile {
  ranges: string[];
  doses: [string, string, string][];
  note: string;
}
export interface RapidProfile {
  ranges: string[];
  doses: string[];
  meals: string[];
  fixed: string[];
  note: string;
  custom: string;
  useSensitivity: boolean;
  sensitivityView: SensitivityView;
  sensitivity: SensitivityProfile;
}
export interface BasalProfile {
  times: string[];
  doses: string[];
  custom: string;
  frequency: '1' | '2' | 'custom';
}
export interface Regimen {
  rapid: RapidId;
  basal: BasalId | 'none';
  rapidProfiles: Partial<Record<RapidId, RapidProfile>>;
  basalProfiles: Partial<Record<BasalId, BasalProfile>>;
  showCorrection: boolean;
  showFixed: boolean;
  showBasal: boolean;
}
export interface Insulin {
  readonly name: string;
  readonly ingredient: string;
  readonly strength: number | null;
  readonly action?: string;
}
export interface Profile {
  id: string;
  name: string;
  updated: number;
  regimen: Regimen;
}
export interface Preferences {
  defaultId: string;
  paperSize: PaperSize;
  updated: number;
}
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem?(key: string): unknown;
}
export interface PaperSettings {
  name: string;
  cssName: string;
  widthMm: number;
  heightMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
}
export const RAPID_INSULINS: Readonly<Record<RapidId, Insulin>>;
export const BASAL_INSULINS: Readonly<Record<BasalId, Insulin>>;
export const SENSITIVITY_NAMES: readonly string[];
export const PAPER_SIZES: Readonly<
  Record<PaperSize, Omit<PaperSettings, 'contentWidthMm' | 'contentHeightMm'>>
>;
export const DEFAULT_NOTE: string;
export const SCHEMA_VERSION: 1;
export const LIMITS: Readonly<{
  maxRows: number;
  maxProfiles: number;
  maxTextLength: number;
  maxImportBytes: number;
}>;
export function clone<T>(value: T): T;
export function createInitialRegimen(): Regimen;
export function createApidraProfile(): RapidProfile;
export function createBlankRapidProfile(): RapidProfile;
export function createBasalProfile(insulinId: BasalId): BasalProfile;
export function createSensitivityPreset(): SensitivityProfile;
export function isValidRegimen(value: unknown): value is Regimen;
export function normalizeRegimen(value: unknown): Regimen;
export function isValidProfile(value: unknown): value is Profile;
export function normalizeProfile(value: unknown): Profile;
export function isValidPreferences(value: unknown): value is Preferences;
export function normalizePreferences(value: unknown): Preferences;
export function decodeProfileFile(json: string): {
  format: 'hhr-insulin-profiles';
  version: 1;
  profiles: Profile[];
  defaultId: string;
};
export function oneLine(value: unknown): string;
export function doseText(value: unknown): string;
export function getCurrentNote(state: Regimen): string;
export function formatRegimenParagraph(state: Regimen): string;
export function getPaperSettings(size?: PaperSize): PaperSettings;
export function getPrintScale(heightPx: number, size?: PaperSize): number;
export function createPaperCss(size?: PaperSize): string;
export function createMemoryStorage(): StorageAdapter;
export class ProfileRepository {
  constructor(options?: {
    storage?: StorageAdapter | null;
    namespace?: string;
    seed?: Profile[];
    preferences?: Preferences | null;
    clock?: () => number;
    createId?: () => string;
  });
  readonly persistent: boolean;
  list(): Profile[];
  get(id: string): Profile | null;
  getPreferences(): Preferences;
  save(name: string, regimen: Regimen, options?: { id?: string }): Profile;
  remove(id: string): boolean;
  setDefault(id?: string): void;
  setPaperSize(size: PaperSize): void;
  initialRegimen(fallback?: Regimen): Regimen;
  export(): string;
  import(json: string): number;
  persist(): boolean;
}
