// Textos por clave. El simulador está fijo en español de Puerto Rico: no hay selector de idioma ni otra traducción
// en uso, en desarrollo ni en producción. Los textos siguen separados por clave (es-PR.json) por si en el futuro
// se aprueba otra traducción; en-US.json queda guardado, sin cargarse.
import es from '../content/locales/es-PR.json';
import type { Genero } from '../sim/tipos';

export const IDIOMA = 'es-PR';
export type Idioma = typeof IDIOMA;
const ES: Record<string, string> = es;

export type Variables = Record<string, string | number>;

/** Reemplaza {nombre} por su valor. No arma oraciones con pedazos: cada mensaje está completo en el JSON. */
export function interpolar(texto: string, vars?: Variables): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function traducir(clave: string, vars?: Variables, dev = import.meta.env.DEV): string {
  const v = ES[clave];
  if (v === undefined) {
    if (dev) console.error(`Falta el texto "${clave}" en es-PR`);
    return clave;
  }
  return interpolar(v, vars);
}

/** Texto con variante de género: busca "clave.m" o "clave.f". */
export function traducirGenero(clave: string, genero: Genero, vars?: Variables): string {
  return traducir(`${clave}.${genero}`, vars);
}
