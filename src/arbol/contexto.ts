// Arma el contexto del intérprete con el contenido existente. DESPERTAR, NARC_STEPS y LLAMAR siguen en
// content.js (los comparte el simulador clásico); aquí se validan con Zod antes de usarlos.
import { CASE_INFO, DESPERTAR, LLAMAR, NARC_STEPS } from '../content.js';
import { ARBOL } from '../sim/arbol/arbol';
import { EsquemaDialogo } from '../sim/arbol/esquemas';
import type { Contexto, PasoPractica } from '../sim/interprete';
import type { CaseDefinition, DialogueProfile } from '../sim/tipos';

export const DIALOGOS: Record<string, DialogueProfile> = Object.fromEntries(
  Object.entries(DESPERTAR as Record<string, unknown>).map(([k, v]) => [k, EsquemaDialogo.parse(v)]),
);

export const PRACTICA: PasoPractica[] = NARC_STEPS as PasoPractica[];

/** "Para recordar en este caso": las mismas lecciones del simulador clásico (CASE_INFO en content.js). */
export function leccionesDe(motor: string): string[] {
  const info = (CASE_INFO as Record<string, { lessons?: unknown }>)[motor];
  return Array.isArray(info?.lessons) ? info.lessons.filter((x): x is string => typeof x === 'string') : [];
}

export function crearContexto(caso: CaseDefinition, extra: Partial<Contexto> = {}): Contexto {
  return { arbol: ARBOL, caso, dialogos: DIALOGOS, practica: PRACTICA, llamarEnDialogo: { d: (LLAMAR as { d: number }).d }, ...extra };
}
