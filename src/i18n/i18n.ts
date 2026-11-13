// Textos por clave. Español de Puerto Rico es el idioma principal. Inglés queda preparado, pero sin traducción
// aprobada: en desarrollo una clave sin traducir se marca como pendiente; en producción no se ofrece el inglés
// hasta que esté completo, para no mostrar traducciones a medias.
import es from '../content/locales/es-PR.json';
import en from '../content/locales/en-US.json';
import type { Genero } from '../sim/tipos';

export type Idioma = 'es-PR' | 'en-US';
export const TEXTOS: Record<Idioma, Record<string, string>> = { 'es-PR': es, 'en-US': en };
const ES: Record<string, string> = es;

export type Variables = Record<string, string | number>;

/** Reemplaza {nombre} por su valor. No arma oraciones con pedazos: cada mensaje está completo en el JSON. */
export function interpolar(texto: string, vars?: Variables): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function traducir(idioma: Idioma, clave: string, vars?: Variables, dev = import.meta.env.DEV): string {
  const v = TEXTOS[idioma][clave];
  if (v !== undefined) return interpolar(v, vars);
  const base = ES[clave];
  if (base === undefined) {
    if (dev) console.error(`Falta el texto "${clave}" en es-PR`);
    return clave;
  }
  return idioma !== 'es-PR' && dev ? `⟦pendiente ${idioma}⟧ ${interpolar(base, vars)}` : interpolar(base, vars);
}

/** Texto con variante de género: busca "clave.m" o "clave.f". */
export function traducirGenero(idioma: Idioma, clave: string, genero: Genero, vars?: Variables): string {
  return traducir(idioma, `${clave}.${genero}`, vars);
}

export function idiomaCompleto(idioma: Idioma): boolean {
  return Object.keys(ES).every((k) => TEXTOS[idioma][k] !== undefined);
}

export function idiomasDisponibles(dev = import.meta.env.DEV): Idioma[] {
  return (['es-PR', 'en-US'] as Idioma[]).filter((i) => i === 'es-PR' || dev || idiomaCompleto(i));
}
