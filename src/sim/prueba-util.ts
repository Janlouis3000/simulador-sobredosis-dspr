// Utilidades de las pruebas del árbol: juegan partidas completas con una política (mejor respuesta o al azar).
import { crearContexto } from '../arbol/contexto';
import {
  avanzarInformacion, elegir, nodo, opcionesDisponibles, perfilDialogo, practicarNaloxona, responderDialogo, seguirDialogo,
} from './interprete';
import type { Contexto } from './interprete';
import { crearPartida } from './interprete';
import type { CaseDefinition, Partida, TrainingProfile } from './tipos';

/** Azar reproducible (mulberry32). */
export function semilla(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ctxDe(caso: CaseDefinition, extra: Partial<Contexto> = {}): Contexto {
  return crearContexto(caso, { azar: semilla(1), ...extra });
}

export type Politica = (ctx: Contexto, p: Partida) => Partida;

/** Siempre la mejor respuesta: opciones correctas, técnica correcta de naloxona y respuestas "ok" al despertar. */
export const mejor: Politica = (ctx, p) => {
  const n = nodo(ctx, p.nodo);
  if (n.type === 'information') return avanzarInformacion(ctx, p);
  if (n.type === 'naloxone_practice') return practicarNaloxona(ctx, p, ctx.practica.map((paso) => Math.max(0, paso.o.findIndex((o) => o.ok))));
  if (n.type === 'dialogue') {
    const d = p.dialogo;
    if (!d) throw new Error('sin diálogo');
    if (d.ultima) return seguirDialogo(ctx, p);
    const turno = perfilDialogo(ctx).turnos[d.turno];
    const k = d.orden.find((i) => turno?.o[i]?.ok === 'ok') ?? d.orden[0];
    return responderDialogo(ctx, p, k as number);
  }
  const ops = opcionesDisponibles(ctx, p);
  // Si ya se puede, la segunda dosis antes que seguir con el apoyo. En paro: un ciclo de RCP y luego la naloxona.
  const naloxonaEnRcp = p.acciones.includes('rcp') ? ops.find((x) => x.id === 'naloxona') : undefined;
  const o = ops.find((x) => x.id === 'segunda_dosis') ?? naloxonaEnRcp ?? ops.find((x) => x.calidad === 'correcta') ?? ops[0];
  if (!o) throw new Error(`Sin opciones en ${p.nodo}`);
  return elegir(ctx, p, o.id);
};

/** Respuestas al azar (para recorrer el árbol completo). */
export function alAzar(r: () => number): Politica {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)] as T;
  return (ctx, p) => {
    const n = nodo(ctx, p.nodo);
    if (n.type === 'information') return avanzarInformacion(ctx, p);
    if (n.type === 'naloxone_practice') return practicarNaloxona(ctx, p, ctx.practica.map((paso) => Math.floor(r() * paso.o.length)));
    if (n.type === 'dialogue') {
      const d = p.dialogo;
      if (!d) throw new Error('sin diálogo');
      return d.ultima ? seguirDialogo(ctx, p) : responderDialogo(ctx, p, pick(d.orden));
    }
    return elegir(ctx, p, pick(opcionesDisponibles(ctx, p)).id);
  };
}

/** Juega hasta terminar o hasta que se cumpla `hasta`. Devuelve la partida y los pasos (nodo.opción) recorridos. */
export function jugar(ctx: Contexto, perfil: TrainingProfile, politica: Politica, hasta?: (p: Partida) => boolean, inicial?: Partida) {
  let p = inicial ?? crearPartida(ctx, perfil);
  const nodos = new Set<string>([p.nodo]);
  for (let i = 0; i < 400 && !p.terminada && !(hasta?.(p)); i++) {
    p = politica(ctx, p);
    nodos.add(p.nodo);
  }
  return { p, nodos };
}
