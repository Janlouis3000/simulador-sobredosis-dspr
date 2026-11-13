// Contexto de idioma para los componentes: t(clave, vars) y tg(clave, género, vars).
import { createContext, useContext } from 'react';
import { traducir, traducirGenero } from '../i18n/i18n';
import type { Idioma, Variables } from '../i18n/i18n';
import type { Genero } from '../sim/tipos';

export interface Traductor {
  idioma: Idioma;
  t: (clave: string, vars?: Variables) => string;
  tg: (clave: string, genero: Genero, vars?: Variables) => string;
}

export function crearTraductor(idioma: Idioma): Traductor {
  return {
    idioma,
    t: (clave, vars) => traducir(idioma, clave, vars),
    tg: (clave, genero, vars) => traducirGenero(idioma, clave, genero, vars),
  };
}

export const IdiomaContexto = createContext<Traductor>(crearTraductor('es-PR'));
export const useT = (): Traductor => useContext(IdiomaContexto);

export function mmss(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
