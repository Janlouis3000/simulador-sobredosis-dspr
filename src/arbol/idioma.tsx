// Contexto de textos para los componentes: t(clave, vars) y tg(clave, género, vars). Siempre en español de
// Puerto Rico (IDIOMA); el contexto se mantiene para que los componentes no lean el JSON directamente.
import { createContext, useContext } from 'react';
import { IDIOMA, traducir, traducirGenero } from '../i18n/i18n';
import type { Idioma, Variables } from '../i18n/i18n';
import type { Genero } from '../sim/tipos';

export interface Traductor {
  idioma: Idioma;
  t: (clave: string, vars?: Variables) => string;
  tg: (clave: string, genero: Genero, vars?: Variables) => string;
}

export const TRADUCTOR: Traductor = {
  idioma: IDIOMA,
  t: (clave, vars) => traducir(clave, vars),
  tg: (clave, genero, vars) => traducirGenero(clave, genero, vars),
};

export const IdiomaContexto = createContext<Traductor>(TRADUCTOR);
export const useT = (): Traductor => useContext(IdiomaContexto);

export function mmss(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
