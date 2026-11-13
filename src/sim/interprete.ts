// Intérprete del árbol de decisiones. Funciones puras: reciben una partida y devuelven otra nueva (la anterior no
// cambia), así cada transición se puede probar sola. El motor fisiológico (engine.js) decide qué le pasa al cuerpo;
// el árbol decide qué se pregunta y qué opciones hay.
import { advance, createSim } from '../engine';
import type { AccionMotor, EventoMotor, Sim } from '../engine';
import { CLINICA } from './config/clinica';
import {
  clasificarRespiracion, clasificarRespuesta, faltaParaDosis, obsColor, obsPupilas, obsRespiracion, obsRespuesta, obsSonido,
} from './observaciones';
import type {
  AccionCritica, CaseDefinition, Condicion, DecisionNode, DecisionOption, DecisionTree, DialogueProfile, EstadoDialogo,
  Partida, TrainingProfile,
} from './tipos';

export interface PasoPractica {
  q: string;
  o: { t: string; ok?: boolean; fb: string; sec?: number; f?: number; wasted?: boolean }[];
}

export interface Contexto {
  arbol: DecisionTree;
  caso: CaseDefinition;
  dialogos: Record<string, DialogueProfile>;
  /** Las tres decisiones de la práctica de naloxona (NARC_STEPS en content.js). */
  practica: PasoPractica[];
  /** Respuesta de "llamar al 9-1-1" durante la conversación (LLAMAR en content.js). */
  llamarEnDialogo: { d: number };
  /** Azar inyectable para pruebas (variante de la conversación y orden de las respuestas). */
  azar?: () => number;
  /** Fija la emoción al despertar (como ?emocion= en el simulador clásico). */
  emocionFija?: string | null;
}

const TERMINAN: EventoMotor[] = ['ems', 'death', 'timeout'];

export function nodo(ctx: Contexto, id: string): DecisionNode {
  const n = ctx.arbol.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`Nodo inexistente: ${id}`);
  return n;
}

function clonar(p: Partida): Partida {
  return structuredClone(p);
}

function sumar<T>(lista: T[], v: T): void {
  if (!lista.includes(v)) lista.push(v);
}

export function quedanDispositivos(s: Sim): boolean {
  return s.doses.length < CLINICA.dispositivosEnKit;
}

export function cumple(ctx: Contexto, p: Partida, c: Condicion): boolean {
  switch (c) {
    case 'sin_naloxona': return p.sim.doses.length === 0;
    case 'dosis_extra_si_respira': return ctx.caso.dosisExtraSiRespira;
    case 'intervalo_dosis_cumplido': return p.sim.doses.length > 0 && faltaParaDosis(p.sim) === 0;
    case 'quedan_dispositivos': return quedanDispositivos(p.sim);
    case 'sin_911': return p.sim.called911 === null;
    case 'con_911': return p.sim.called911 !== null;
    case 'no_responde': return clasificarRespuesta(p.sim) === 'no_responde';
  }
}

export function opcionesDisponibles(ctx: Contexto, p: Partida): DecisionOption[] {
  const n = nodo(ctx, p.nodo);
  return (n.options ?? []).filter((o) =>
    (!o.perfiles || o.perfiles.includes(p.perfil)) && (o.requiere ?? []).every((c) => cumple(ctx, p, c)));
}

export function crearPartida(ctx: Contexto, perfil: TrainingProfile): Partida {
  const p: Partida = {
    casoId: ctx.caso.id, perfil, nodo: ctx.arbol.inicio, sim: createSim(ctx.caso.motor), registro: [], acciones: [], flags: [],
    dispositivosUsados: 0, observaciones: [], ultimoEvento: null, dialogo: null, terminada: false, fin: null,
  };
  return irA(ctx, p, ctx.arbol.inicio, null);
}

// ---------- Efectos ----------
function darDosis(p: Partida, f: number): void {
  p.sim.doses.push({ t: p.sim.t, f });
  p.dispositivosUsados = p.sim.doses.length;
}

function llamar(p: Partida): void {
  if (p.sim.called911 === null) p.sim.called911 = p.sim.t;
  sumar<AccionCritica>(p.acciones, 'llamar_911');
}

/** Avanza el motor; devuelve el primer evento (el motor se detiene ahí, como en el simulador clásico). */
function correr(p: Partida, seg: number, accion: AccionMotor | undefined): EventoMotor | null {
  if (seg <= 0) return null;
  const ev = advance(p.sim, seg, accion ?? 'none');
  return ev[0] ?? null;
}

function esperarHastaEvento(p: Partida): EventoMotor {
  for (;;) {
    const ev = advance(p.sim, CLINICA.tiempos.pasoEsperaEms, 'none');
    if (ev.length) return ev[0] as EventoMotor;
  }
}

/** Va a un nodo. Resuelve evaluaciones con el motor y las interrupciones. */
function irA(ctx: Contexto, p: Partida, destino: string, evento: EventoMotor | null): Partida {
  p.ultimoEvento = evento;
  let id = destino;
  for (let vueltas = 0; vueltas < 20; vueltas++) {
    const n = nodo(ctx, id);
    if (id === 'lateral') sumar(p.flags, 'llego_lateral');
    if (n.type === 'assessment') {
      const clas = n.evalua === 'respuesta' ? clasificarRespuesta(p.sim) : clasificarRespiracion(p.sim, n.evalua === 'respiracion_propia');
      if (n.evalua === 'respuesta') p.observaciones.push(obsRespuesta(p.sim));
      else p.observaciones.push(obsRespiracion(p.sim), obsSonido(p.sim), obsColor(p.sim));
      if (clas === 'respira_anormal') sumar(p.flags, 'hubo_respiracion_anormal');
      if (clas === 'no_respira') sumar(p.flags, 'hubo_paro');
      const sig = n.routes?.[clas];
      if (!sig) throw new Error(`El nodo ${id} no tiene ruta para ${clas}`);
      id = sig;
      continue;
    }
    p.nodo = id;
    if (n.type === 'outcome') {
      p.terminada = true;
      if (!p.fin) p.fin = evento === 'ems' ? 'ems' : evento === 'death' ? 'muerte' : evento === 'timeout' ? 'tiempo' : p.fin;
    }
    if (n.type === 'dialogue' && !p.dialogo) p.dialogo = iniciarDialogo(ctx, p);
    if (p.sim.arrest) sumar(p.flags, 'hubo_paro');
    return p;
  }
  throw new Error('Demasiadas evaluaciones seguidas: revisa las rutas del árbol');
}

/** Después de una acción: si el motor produjo un evento, salta a su nodo; si no, sigue al destino normal. */
function continuar(ctx: Contexto, p: Partida, evento: EventoMotor | null, normal: string): Partida {
  if (evento === 'vomit' && p.sim.position === 'lado') {
    // De lado el vómito sale de la boca: no hace falta decidir nada.
    p.sim.vomitHandled = true;
    sumar(p.flags, 'vomito_de_lado');
    p.observaciones.push({ t: p.sim.t, clave: 'obs.evento.vomito_de_lado' });
    return irA(ctx, p, normal, evento);
  }
  if (evento === 'arrest') sumar(p.flags, 'hubo_paro');
  const destino = evento ? (ctx.arbol.interrupciones[evento] ?? normal) : normal;
  return irA(ctx, p, destino, evento);
}

// ---------- Transiciones ----------
/** "Continuar" en los nodos de información. */
export function avanzarInformacion(ctx: Contexto, p0: Partida): Partida {
  const n = nodo(ctx, p0.nodo);
  if (n.type !== 'information' || !n.next) throw new Error(`El nodo ${n.id} no es de información`);
  return irA(ctx, clonar(p0), n.next, null);
}

export function elegir(ctx: Contexto, p0: Partida, opcionId: string): Partida {
  const n = nodo(ctx, p0.nodo);
  const o = opcionesDisponibles(ctx, p0).find((x) => x.id === opcionId);
  if (!o) throw new Error(`Opción ${opcionId} no disponible en ${n.id}`);
  const p = clonar(p0);
  const e = o.effects ?? {};
  p.registro.push({ t: p.sim.t, nodo: n.id, opcion: o.id, calidad: o.calidad, feedbackKey: o.feedbackKey, perfil: p.perfil });
  if (e.llamar911) llamar(p);
  if (e.abrirViaAerea) p.sim.airwayOpen = true;
  if (e.posicion) p.sim.position = e.posicion;
  if (e.mito) p.sim.myths++;
  if (e.dosisNueva) { darDosis(p, 1); sumar(p.flags, 'dispositivo_nuevo'); }
  for (const f of e.flags ?? []) sumar(p.flags, f);
  for (const a of e.requiredActions ?? []) sumar(p.acciones, a);
  if (e.flags?.includes('vio_pupilas')) p.observaciones.push(obsPupilas(p.sim));
  if (p.flags.includes('broncoaspiro') && !p.sim.aspirated && n.id === 'vomito') {
    // Igual que el simulador clásico (openVomit): el vómito pasa a los pulmones.
    p.sim.aspirated = true; p.sim.damage += 28; p.sim.o2 = Math.max(10, p.sim.o2 - 14);
  }
  if (n.id === 'vomito' && o.id === 'de_lado') p.sim.vomitHandled = true;

  if (e.irse) {
    p.sim.left = true;
    let ev: EventoMotor;
    do { ev = esperarHastaEvento(p); } while (!TERMINAN.includes(ev));
    p.fin = 'irse';
    return irA(ctx, p, o.next, ev);
  }
  if (e.esperarEms) {
    const ev = esperarHastaEvento(p);
    return continuar(ctx, p, ev, o.next);
  }
  const ev = correr(p, e.elapsedSeconds ?? 0, e.accionMotor);
  return continuar(ctx, p, ev, o.next);
}

/**
 * Práctica de naloxona: respuestas = índice escogido en cada paso de ctx.practica (se detiene si se perdió la dosis).
 * Igual que giveDose del simulador clásico: probarla al aire pierde el dispositivo; usar las dos fosas o presionar
 * despacio da solo parte de la dosis.
 */
export function practicarNaloxona(ctx: Contexto, p0: Partida, respuestas: number[]): Partida {
  const n = nodo(ctx, p0.nodo);
  if (n.type !== 'naloxone_practice' || !n.next) throw new Error(`El nodo ${n.id} no es de práctica de naloxona`);
  if (!quedanDispositivos(p0.sim)) throw new Error('No quedan dispositivos');
  const p = clonar(p0);
  let f = 1, sec = 0, perdida = false;
  respuestas.forEach((r, i) => {
    const paso = ctx.practica[i];
    const op = paso?.o[r];
    if (!paso || !op || perdida) return;
    p.registro.push({ t: p.sim.t, nodo: n.id, opcion: `paso${i + 1}.${r}`, calidad: op.ok ? 'correcta' : op.wasted ? 'incorrecta' : 'aceptable', texto: { opcion: op.t, fb: op.fb }, perfil: p.perfil });
    if (!op.ok) sumar(p.flags, `naloxona_error_${i + 1}`);
    if (op.sec) sec += op.sec;
    if (op.f !== undefined) f = Math.min(f, op.f);
    if (op.wasted) perdida = true;
  });
  if (perdida) {
    darDosis(p, 0);
    sumar(p.flags, 'dosis_perdida');
    p.observaciones.push({ t: p.sim.t, clave: 'obs.naloxona.perdida' });
    // Con otro dispositivo se puede intentar de nuevo; sin dispositivos, se sigue sin naloxona.
    if (quedanDispositivos(p.sim)) { p.ultimoEvento = null; return p; }
    const ev = correr(p, sec, 'none');
    return continuar(ctx, p, ev, n.next);
  }
  darDosis(p, f);
  sumar<AccionCritica>(p.acciones, 'naloxona');
  p.observaciones.push({ t: p.sim.t, clave: f < 1 ? 'obs.naloxona.parcial' : 'obs.naloxona.completa' });
  const ev = correr(p, CLINICA.tiempos.administrarNaloxona + sec, 'none');
  return continuar(ctx, p, ev, n.next);
}

/** La demostración de naloxona se vio completa (o hasta el final de los pasos). */
export function marcarDemoVista(p0: Partida): Partida {
  const p = clonar(p0);
  sumar(p.flags, 'vio_demo');
  return p;
}

// ---------- Conversación al despertar ----------
function azar(ctx: Contexto): number {
  return (ctx.azar ?? Math.random)();
}

export function perfilDialogo(ctx: Contexto): DialogueProfile {
  const d = ctx.dialogos[ctx.caso.dialogo];
  if (!d) throw new Error(`Perfil de diálogo inexistente: ${ctx.caso.dialogo}`);
  return d;
}

function ordenTurno(ctx: Contexto, p: Partida, turno: number): number[] {
  const t = perfilDialogo(ctx).turnos[turno];
  if (!t) return [];
  const idx = t.o.map((_, i) => i).filter((i) => t.o[i]?.accion !== 'dosis' || quedanDispositivos(p.sim));
  return idx.map((i) => [azar(ctx), i] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

function iniciarDialogo(ctx: Contexto, p: Partida): EstadoDialogo {
  const perfil = perfilDialogo(ctx);
  const fijas = perfil.variantes.map((v, i) => [v, i] as const).filter(([v]) => v.emocion === ctx.emocionFija).map(([, i]) => i);
  const opciones = fijas.length ? fijas : perfil.variantes.map((_, i) => i);
  const variante = opciones[Math.floor(azar(ctx) * opciones.length)] ?? 0;
  const est: EstadoDialogo = { variante, turno: 0, agitacion: perfil.variantes[variante]?.agit ?? 50, orden: [], malas: 0, cancelo: false };
  est.orden = ordenTurno(ctx, p, 0);
  return est;
}

const C = CLINICA.dialogo;
const limitar = (a: number) => Math.max(0, Math.min(C.maxima, a));

/** Escoge una respuesta (índice en el turno, no en el orden mostrado). */
export function responderDialogo(ctx: Contexto, p0: Partida, indice: number): Partida {
  if (!p0.dialogo || p0.dialogo.ultima || p0.dialogo.fin) throw new Error('No se espera una respuesta ahora');
  const p = clonar(p0);
  const d = p.dialogo as EstadoDialogo;
  const turno = perfilDialogo(ctx).turnos[d.turno];
  const o = turno?.o[indice];
  if (!turno || !o || !d.orden.includes(indice)) throw new Error(`Respuesta ${indice} no disponible`);
  p.registro.push({ t: p.sim.t, nodo: 'despierta', opcion: `turno${d.turno + 1}.${indice}`, calidad: o.ok === 'ok' ? 'correcta' : o.ok === 'mid' ? 'aceptable' : 'incorrecta', texto: { opcion: o.t, fb: o.fb }, perfil: p.perfil });
  if (o.ok === 'no') d.malas++;
  if (o.accion === 'dosis') { darDosis(p, 1); sumar(p.flags, 'dosis_despierto'); }
  if (o.accion === 'cancelar') {
    d.cancelo = true; sumar(p.flags, 'cancelo_ambulancia');
    if (p.sim.called911 !== null) p.observaciones.push({ t: p.sim.t, clave: 'obs.evento.ambulancia_cancelada' });
    p.sim.called911 = null;
    p.acciones = p.acciones.filter((a) => a !== 'llamar_911');
  }
  d.agitacion = limitar(d.agitacion + o.d);
  const seVa = o.accion !== 'irse' && d.agitacion >= C.maxima && d.turno >= C.turnoMinimoParaIrse;
  d.ultima = { opcion: indice, seVa };
  if (o.accion === 'irse') d.fin = 'dejar';
  else if (seVa) d.fin = 'seVa';
  else if (d.turno === C.turnos - 1) d.fin = d.agitacion <= C.calma ? 'calma' : 'malaGana';
  return p;
}

/** "Seguir" después de ver la explicación de una respuesta. */
export function seguirDialogo(ctx: Contexto, p0: Partida): Partida {
  if (!p0.dialogo?.ultima) throw new Error('No hay una respuesta que seguir');
  const p = clonar(p0);
  const d = p.dialogo as EstadoDialogo;
  if (d.fin === 'dejar' || d.fin === 'seVa') {
    p.fin = d.fin;
    sumar(p.flags, d.fin === 'seVa' ? 'se_fue' : 'la_dejo_ir');
    return irA(ctx, p, 'resultado', null);
  }
  if (d.fin) {
    if (d.fin === 'calma') sumar(p.flags, 'calmo');
    const n = nodo(ctx, 'despierta');
    return irA(ctx, p, n.next ?? 'esperar', null);
  }
  d.turno++;
  d.ultima = undefined;
  d.orden = ordenTurno(ctx, p, d.turno);
  return p;
}

/** Llamar al 9-1-1 en altavoz sin dejar de hablarle (botón aparte; no gasta el turno). */
export function llamarEnDialogo(ctx: Contexto, p0: Partida): Partida {
  if (!p0.dialogo || p0.sim.called911 !== null) throw new Error('No se puede llamar ahora');
  const p = clonar(p0);
  llamar(p);
  sumar(p.flags, 'llamo_despierto');
  (p.dialogo as EstadoDialogo).agitacion = limitar((p.dialogo as EstadoDialogo).agitacion + ctx.llamarEnDialogo.d);
  return p;
}
