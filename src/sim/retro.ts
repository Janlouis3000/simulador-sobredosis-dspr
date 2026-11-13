// Retroalimentación final: distingue acciones críticas completadas, acciones a reforzar y lo que se practicó.
// No es una puntuación. Todo sale de la partida (registro, acciones y estado del motor).
import { outcome } from '../engine';
import type { AccionCritica, CaseDefinition, FeedbackItem, Partida, SimulationResult } from './tipos';

/** Algunas acciones críticas solo aplican si la situación se dio. */
function aplica(a: AccionCritica, p: Partida): boolean {
  switch (a) {
    case 'posicion_lateral': return p.flags.includes('llego_lateral') || p.flags.includes('vomito_de_lado') || p.sim.vomitAt !== null;
    case 'apoyo_respiratorio': return p.flags.includes('hubo_respiracion_anormal');
    case 'rcp': return p.flags.includes('hubo_paro');
    default: return true;
  }
}

function hecha(a: AccionCritica, p: Partida): boolean {
  if (a === 'posicion_lateral') return p.acciones.includes(a) || p.flags.includes('vomito_de_lado');
  if (a === 'no_dejar_sola') return p.acciones.includes(a) && !['irse', 'dejar'].includes(p.fin ?? '');
  if (a === 'llamar_911') return p.sim.called911 !== null;
  return p.acciones.includes(a);
}

const ITEMS_EXTRA: [string, string][] = [
  ['dosis_perdida', 'retro.reforzar.no_probar'],
  ['dosis_despierto', 'retro.reforzar.dosis_despierto'],
  ['cancelo_ambulancia', 'retro.reforzar.cancelar'],
  ['broncoaspiro', 'retro.reforzar.vomito'],
  ['se_fue', 'retro.reforzar.se_fue'],
];

export function calcularResultado(caso: CaseDefinition, p: Partida): SimulationResult {
  let desenlace: SimulationResult['desenlace'] = outcome(p.sim);
  if ((p.fin === 'dejar' || p.fin === 'seVa') && desenlace !== 'muerte') desenlace = 'riesgo';
  if (p.fin === 'irse' && desenlace !== 'muerte' && p.sim.awakeAt !== null && p.sim.called911 === null) desenlace = 'riesgo';

  const completadas: FeedbackItem[] = [];
  const reforzar: FeedbackItem[] = [];
  for (const a of caso.accionesCriticas) {
    if (!aplica(a, p)) continue;
    if (hecha(a, p)) completadas.push({ id: a, textKey: `retro.hecho.${a}` });
    else reforzar.push({ id: a, textKey: `retro.falta.${a}` });
  }
  // Decisiones incorrectas del árbol (sin repetir) y errores de técnica.
  const vistas = new Set<string>();
  for (const r of p.registro) {
    if (r.calidad !== 'incorrecta' || !r.feedbackKey || vistas.has(r.feedbackKey)) continue;
    vistas.add(r.feedbackKey);
    reforzar.push({ id: `${r.nodo}.${r.opcion}`, textKey: r.feedbackKey });
  }
  if (p.flags.some((f) => f.startsWith('naloxona_error_')) && !p.flags.includes('dosis_perdida'))
    reforzar.push({ id: 'tecnica', textKey: 'retro.reforzar.tecnica' });
  for (const [flag, key] of ITEMS_EXTRA) if (p.flags.includes(flag)) reforzar.push({ id: flag, textKey: key });
  // Mensaje general de mitos solo si ninguna explicación específica ya lo cubre (no repetir lo mismo).
  const mitoExplicado = p.registro.some((r) => r.nodo === 'responde' && r.calidad === 'incorrecta');
  if (p.sim.myths > 0 && !mitoExplicado) reforzar.push({ id: 'mitos', textKey: 'retro.reforzar.mitos' });

  const practicadas: FeedbackItem[] = [{ id: 'perfil', textKey: `retro.perfil.${p.perfil}` }];
  if (p.flags.includes('vio_demo')) practicadas.push({ id: 'demo', textKey: 'retro.practica.demo' });
  if (p.acciones.includes('naloxona') || p.flags.includes('dosis_perdida')) practicadas.push({ id: 'naloxona', textKey: 'retro.practica.naloxona' });
  if (p.acciones.includes('apoyo_respiratorio')) practicadas.push({ id: 'apoyo', textKey: p.perfil === 'cpr_trained' ? 'retro.practica.respiraciones' : 'retro.practica.operador' });
  if (p.acciones.includes('rcp')) practicadas.push({ id: 'rcp', textKey: p.perfil === 'cpr_trained' ? 'retro.practica.rcp' : 'retro.practica.compresiones' });
  if (p.dialogo) practicadas.push({ id: 'dialogo', textKey: 'retro.practica.conversacion' });

  const primeraDosis = p.sim.doses.find((d) => d.f > 0)?.t ?? null;
  const apoyo = p.registro.find((r) => ['respiraciones', 'operador', 'rcp_30_2', 'compresiones_guiadas'].includes(r.opcion) && ['ventilar', 'rcp'].includes(r.nodo));
  return {
    desenlace,
    perfil: p.perfil,
    completadas,
    reforzar,
    practicadas,
    tiempos: { llamada: p.sim.called911, primeraDosis, primerApoyo: apoyo?.t ?? null, total: p.sim.t },
    mensajeCentralKey: 'retro.mensaje_central',
    revision: caso.revision,
  };
}
