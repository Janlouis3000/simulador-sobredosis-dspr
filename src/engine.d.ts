// Tipos del motor fisiológico (engine.js). El motor sigue en JavaScript y sus 44 pruebas no cambian;
// este archivo solo le da tipos al código TypeScript que lo usa.

export type CaseId = 'fentanilo' | 'pastillas' | 'xilazina' | 'tardio';
export type AccionMotor = 'none' | 'breaths' | 'cpr';
export type EventoMotor = 'arrest' | 'rosc' | 'vomit' | 'awake' | 'ems' | 'death' | 'timeout';
export type Desenlace = 'sobrevive' | 'dano' | 'muerte';

export interface Dosis { t: number; f: number }

export interface Sim {
  caseId: CaseId;
  t: number;
  o2: number;
  opioid: number;
  rise: number;
  cap: number;
  xyl: number;
  damage: number;
  lowO2: number;
  doses: Dosis[];
  position: 'espalda' | 'lado';
  airwayOpen: boolean;
  hist: [number, number, number, boolean][];
  called911: number | null;
  checkedResp: number | null;
  checkedBreath: number | null;
  firstVent: number | null;
  arrest: boolean;
  arrestAt: number | null;
  arrestNoCpr: number;
  cprInArrest: number;
  rosc: number | null;
  vomitAt: number | null;
  vomitHandled: boolean;
  aspirated: boolean;
  awakeAt: number | null;
  awakeChoice: string | null;
  left: boolean;
  myths: number;
  unneeded: string[];
  log: unknown[];
  ended: boolean;
  outcome: Desenlace | null;
  critSeconds: number;
}

export interface Derivados {
  eff: number;
  rr: number;
  /** 0 no responde, 1 responde al dolor, 2 somnolienta, 3 despierta */
  cons: 0 | 1 | 2 | 3;
  pupil: number;
  block: number;
}

export interface ParametrosCaso {
  o2: number; opioid: number; rise: number; cap: number; xyl: number; damage: number; arrest?: boolean; label: string;
}

export const CASES: Record<CaseId, ParametrosCaso>;
export const EMS_DELAY: number;
export const T_LIMIT: number;
export const DOSES: number;
export function createSim(caseId: CaseId): Sim;
export function derived(s: Sim): Derivados;
export function step(s: Sim, action: AccionMotor): void;
export function advance(s: Sim, n: number, action: AccionMotor): EventoMotor[];
export function outcome(s: Sim): Desenlace;
export function naloxBlock(s: Sim, t: number): number;
