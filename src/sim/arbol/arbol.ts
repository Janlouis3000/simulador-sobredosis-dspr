// Árbol de decisiones único para todos los casos. Cada caso (sim/casos) solo cambia el motor, los textos de la
// escena, el perfil de diálogo y las acciones críticas. Los nodos "assessment" no los escoge la persona usuaria:
// el intérprete los resuelve con el estado del motor (sim/observaciones.ts) y sigue la ruta que corresponde.
//
// Claves de texto: nodo.<id>.prompt, op.<nodo>.<opcion> (botón) y fb.<nodo>.<opcion> (explicación).
import { CLINICA } from '../config/clinica';
import type { Ancla, DecisionNode, DecisionOption, DecisionTree, Fase, Icono } from '../tipos';

const T = CLINICA.tiempos;

function op(nodo: string, id: string, next: string, calidad: DecisionOption['calidad'], extra: Partial<DecisionOption> = {}): DecisionOption {
  return { id, labelKey: `op.${nodo}.${id}`, feedbackKey: `fb.${nodo}.${id}`, next, calidad, ...extra };
}

const nodos: DecisionNode[] = [
  { id: 'aviso', type: 'information', promptKey: 'nodo.aviso.prompt', next: 'encontrar' },
  { id: 'encontrar', type: 'information', promptKey: 'nodo.encontrar.prompt', next: 'seguridad' },

  {
    id: 'seguridad', type: 'choice', promptKey: 'nodo.seguridad.prompt', requiereRevisionClinica: true,
    options: [
      op('seguridad', 'mirar', 'responde', 'correcta', { effects: { elapsedSeconds: T.seguridadEscena } }),
      op('seguridad', 'correr', 'responde', 'aceptable'),
    ],
  },

  {
    id: 'responde', type: 'choice', promptKey: 'nodo.responde.prompt',
    options: [
      op('responde', 'llamar_frotar', 'eval_respuesta', 'correcta', { effects: { elapsedSeconds: T.comprobarRespuesta, requiredActions: ['comprobar_respuesta'] } }),
      op('responde', 'agua', 'responde', 'incorrecta', { effects: { elapsedSeconds: T.aguaFria, mito: true, clinicalSafety: -1 } }),
      op('responde', 'dormir', 'responde', 'incorrecta', { effects: { elapsedSeconds: T.dejarDormir, mito: true, clinicalSafety: -2 } }),
    ],
  },
  { id: 'eval_respuesta', type: 'assessment', promptKey: 'nodo.eval_respuesta.prompt', evalua: 'respuesta', routes: { responde: 'vigilar', no_responde: 'respiracion' } },

  {
    id: 'respiracion', type: 'choice', promptKey: 'nodo.respiracion.prompt',
    options: [
      op('respiracion', 'mirar_pecho', 'eval_respiracion', 'correcta', { effects: { elapsedSeconds: T.evaluarRespiracion, requiredActions: ['evaluar_respiracion'] } }),
      op('respiracion', 'pupilas', 'respiracion', 'aceptable', { effects: { elapsedSeconds: T.mirarPupilas, flags: ['vio_pupilas'] } }),
    ],
  },
  { id: 'eval_respiracion', type: 'assessment', promptKey: 'nodo.eval_respiracion.prompt', evalua: 'respiracion', routes: { respira_normal: 'lateral', respira_anormal: 'llamar', no_respira: 'llamar_paro' } },

  {
    id: 'llamar', type: 'choice', promptKey: 'nodo.llamar.prompt',
    options: [
      op('llamar', 'altavoz', 'operador', 'correcta', { effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'] } }),
      op('llamar', 'esperar', 'llamar', 'incorrecta', { effects: { elapsedSeconds: T.esperarSinActuar, clinicalSafety: -1 } }),
      op('llamar', 'no_llamar', 'llamar', 'incorrecta', { effects: { elapsedSeconds: T.esperarSinActuar, clinicalSafety: -1 } }),
    ],
  },

  // No respira o solo jadea (AHA 2025): llamar en altavoz y empezar la RCP sin demorarla por la naloxona.
  {
    id: 'llamar_paro', type: 'choice', promptKey: 'nodo.llamar_paro.prompt',
    options: [
      op('llamar_paro', 'altavoz_rcp', 'rcp', 'correcta', { perfiles: ['cpr_trained'], effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'] } }),
      op('llamar_paro', 'altavoz_compresiones', 'rcp', 'correcta', { perfiles: ['basic_responder', 'unsure'], effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'] } }),
      op('llamar_paro', 'naloxona_primero', 'naloxona', 'incorrecta', { effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'], clinicalSafety: -1 } }),
    ],
  },
  {
    id: 'operador', type: 'information', promptKey: 'nodo.operador.prompt', next: 'naloxona',
    promptKeyPorPerfil: { cpr_trained: 'nodo.operador.cpr_trained', basic_responder: 'nodo.operador.basic_responder', unsure: 'nodo.operador.unsure' },
  },

  // Demostración paso a paso (se puede omitir) y práctica de las tres decisiones de NARC_STEPS.
  { id: 'naloxona', type: 'naloxone_practice', promptKey: 'nodo.naloxona.prompt', next: 'via_aerea', esPrimeraDosis: true },

  {
    id: 'via_aerea', type: 'choice', promptKey: 'nodo.via_aerea.prompt',
    options: [
      op('via_aerea', 'abrir', 'apoyo', 'correcta', { effects: { elapsedSeconds: T.abrirViaAerea, abrirViaAerea: true, posicion: 'espalda', requiredActions: ['abrir_via_aerea'] } }),
      op('via_aerea', 'esperar', 'apoyo', 'incorrecta', { effects: { elapsedSeconds: T.esperarSinActuar, clinicalSafety: -1 } }),
    ],
  },
  { id: 'apoyo', type: 'assessment', promptKey: 'nodo.apoyo.prompt', evalua: 'respiracion_propia', routes: { no_respira: 'rcp', respira_anormal: 'ventilar', respira_normal: 'lateral' } },

  {
    id: 'ventilar', type: 'choice', promptKey: 'nodo.ventilar.prompt',
    options: [
      op('ventilar', 'respiraciones', 'reevaluar', 'correcta', { perfiles: ['cpr_trained'], effects: { elapsedSeconds: T.respiracionesRescate, accionMotor: 'breaths', abrirViaAerea: true, requiredActions: ['apoyo_respiratorio'] } }),
      op('ventilar', 'operador', 'reevaluar', 'correcta', { perfiles: ['basic_responder', 'unsure'], effects: { elapsedSeconds: T.vigilar, abrirViaAerea: true, requiredActions: ['apoyo_respiratorio'] } }),
      op('ventilar', 'esperar', 'reevaluar', 'incorrecta', { effects: { elapsedSeconds: T.vigilar, clinicalSafety: -1 } }),
    ],
  },

  {
    id: 'rcp', type: 'cpr_practice', promptKey: 'nodo.rcp.prompt',
    options: [
      op('rcp', 'rcp_30_2', 'reevaluar', 'correcta', { perfiles: ['cpr_trained'], effects: { elapsedSeconds: T.rcp, accionMotor: 'cpr', requiredActions: ['rcp'] } }),
      op('rcp', 'compresiones_guiadas', 'reevaluar', 'correcta', { perfiles: ['basic_responder', 'unsure'], effects: { elapsedSeconds: T.rcp, accionMotor: CLINICA.rutaBasica.accionMotorCompresionesGuiadas, requiredActions: ['rcp'] } }),
      // Todavía sin naloxona: darla rápido y volver a la RCP (si hay otra persona, que la dé ella).
      op('rcp', 'naloxona', 'naloxona', 'correcta', { requiere: ['sin_naloxona'] }),
      op('rcp', 'de_lado', 'reevaluar', 'incorrecta', { effects: { elapsedSeconds: T.posicionLateral, posicion: 'lado', clinicalSafety: -2 } }),
    ],
  },

  { id: 'reevaluar', type: 'assessment', promptKey: 'nodo.reevaluar.prompt', evalua: 'respiracion_propia', routes: { no_respira: 'rcp', respira_anormal: 'decidir', respira_normal: 'lateral' } },

  {
    id: 'decidir', type: 'choice', promptKey: 'nodo.decidir.prompt',
    options: [
      op('decidir', 'segunda_dosis', 'reevaluar', 'correcta', {
        requiere: ['intervalo_dosis_cumplido', 'quedan_dispositivos'],
        effects: { elapsedSeconds: T.administrarNaloxona, dosisNueva: true, requiredActions: ['segunda_dosis'] },
      }),
      op('decidir', 'seguir_apoyo', 'ventilar', 'correcta'),
    ],
  },

  {
    id: 'lateral', type: 'choice', promptKey: 'nodo.lateral.prompt',
    options: [
      op('lateral', 'de_lado', 'vigilar', 'correcta', { effects: { elapsedSeconds: T.posicionLateral, posicion: 'lado', requiredActions: ['posicion_lateral'] } }),
      op('lateral', 'boca_arriba', 'vigilar', 'incorrecta', { effects: { clinicalSafety: -1 } }),
    ],
  },

  {
    id: 'vigilar', type: 'choice', promptKey: 'nodo.vigilar.prompt',
    options: [
      op('vigilar', 'quedarse', 'eval_vigilar', 'correcta', { effects: { elapsedSeconds: T.vigilar, requiredActions: ['vigilar', 'no_dejar_sola'] } }),
      // Respira por su cuenta, pero no responde: otra dosis después del intervalo (guía de NARCAN). REQUIERE REVISIÓN CLÍNICA.
      op('vigilar', 'segunda_dosis', 'eval_vigilar', 'correcta', {
        requiere: ['intervalo_dosis_cumplido', 'quedan_dispositivos', 'no_responde', 'dosis_extra_si_respira'],
        effects: { elapsedSeconds: T.administrarNaloxona, dosisNueva: true, requiredActions: ['segunda_dosis'] },
      }),
      op('vigilar', 'llamar', 'vigilar', 'correcta', { requiere: ['sin_911'], effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'] } }),
      op('vigilar', 'irse', 'resultado', 'incorrecta', { effects: { irse: true, clinicalSafety: -3 } }),
    ],
  },
  { id: 'eval_vigilar', type: 'assessment', promptKey: 'nodo.eval_vigilar.prompt', evalua: 'respiracion_propia', routes: { no_respira: 'rcp', respira_anormal: 'decidir', respira_normal: 'vigilar' } },

  // Interrupciones del motor
  {
    id: 'vomito', type: 'choice', promptKey: 'nodo.vomito.prompt',
    options: [
      op('vomito', 'de_lado', 'reevaluar', 'correcta', { effects: { elapsedSeconds: 10, posicion: 'lado', flags: ['vomito_de_lado'] } }),
      op('vomito', 'seguir', 'reevaluar', 'incorrecta', { effects: { flags: ['broncoaspiro'], clinicalSafety: -2 } }),
    ],
  },
  { id: 'paro', type: 'information', promptKey: 'nodo.paro.prompt', next: 'rcp' },
  { id: 'pulso', type: 'information', promptKey: 'nodo.pulso.prompt', next: 'reevaluar' },

  // Al despertar: conversación (DESPERTAR en content.js). Si se queda, se espera la ambulancia.
  { id: 'despierta', type: 'dialogue', promptKey: 'nodo.despierta.prompt', next: 'esperar' },

  {
    id: 'esperar', type: 'choice', promptKey: 'nodo.esperar.prompt', requiere911: true,
    options: [
      op('esperar', 'quedarse', 'resultado', 'correcta', { requiere: ['con_911'], effects: { esperarEms: true, requiredActions: ['vigilar', 'no_dejar_sola'] } }),
      op('esperar', 'llamar', 'esperar', 'correcta', { requiere: ['sin_911'], effects: { elapsedSeconds: T.llamar911, llamar911: true, requiredActions: ['llamar_911'] } }),
    ],
  },

  { id: 'resultado', type: 'outcome', promptKey: 'nodo.resultado.prompt' },
];

// ---------- Presentación: fases, pistas e iconos sobre la escena 3D ----------
// Fase de cada paso (para el resumen al terminar una fase).
const FASE_DE: Record<Fase, string[]> = {
  evaluar: ['aviso', 'encontrar', 'seguridad', 'responde', 'respiracion'],
  ayuda: ['llamar', 'llamar_paro', 'operador', 'naloxona'],
  apoyo: ['via_aerea', 'ventilar', 'rcp', 'decidir', 'lateral', 'vigilar', 'vomito', 'paro', 'pulso'],
  despertar: ['despierta', 'esperar', 'resultado'],
};
// Pista del modo guiado: textos de "retro.falta.*" que ya usa el informe.
const PISTA_DE: Record<string, string> = {
  responde: 'retro.falta.comprobar_respuesta', respiracion: 'retro.falta.evaluar_respiracion', llamar: 'retro.falta.llamar_911',
  llamar_paro: 'retro.falta.rcp', naloxona: 'retro.falta.naloxona', via_aerea: 'retro.falta.abrir_via_aerea',
  ventilar: 'retro.falta.apoyo_respiratorio', rcp: 'retro.falta.rcp', decidir: 'retro.falta.segunda_dosis',
  lateral: 'retro.falta.posicion_lateral', vigilar: 'retro.falta.vigilar', vomito: 'retro.reforzar.vomito', esperar: 'retro.falta.no_dejar_sola',
};
// Icono de cada opción y sobre qué va en la escena. Las correctas y las incorrectas llevan icono por igual, para
// que el icono no delate la respuesta. Las que no tienen un lugar natural quedan solo en la lista.
const VISUAL: Record<string, [Ancla, Icono]> = {
  'responde.llamar_frotar': ['pecho', 'mano'], 'responde.agua': ['cabeza', 'gota'], 'responde.dormir': ['piernas', 'reloj'],
  'respiracion.mirar_pecho': ['boca', 'respirar'], 'respiracion.pupilas': ['ojos', 'ojo'],
  'llamar.altavoz': ['telefono', 'telefono'], 'llamar.esperar': ['piernas', 'reloj'],
  'llamar_paro.altavoz_rcp': ['telefono', 'telefono'], 'llamar_paro.altavoz_compresiones': ['telefono', 'telefono'], 'llamar_paro.naloxona_primero': ['kit', 'naloxona'],
  'via_aerea.abrir': ['cabeza', 'via'], 'via_aerea.esperar': ['piernas', 'reloj'],
  'ventilar.respiraciones': ['boca', 'respirar'], 'ventilar.operador': ['telefono', 'telefono'], 'ventilar.esperar': ['piernas', 'reloj'],
  'rcp.rcp_30_2': ['pecho', 'corazon'], 'rcp.compresiones_guiadas': ['pecho', 'corazon'], 'rcp.naloxona': ['kit', 'naloxona'], 'rcp.de_lado': ['cadera', 'lado'],
  'decidir.segunda_dosis': ['kit', 'naloxona'], 'decidir.seguir_apoyo': ['boca', 'respirar'],
  'lateral.de_lado': ['cadera', 'lado'], 'lateral.boca_arriba': ['piernas', 'reloj'],
  'vigilar.quedarse': ['pecho', 'ojo'], 'vigilar.segunda_dosis': ['kit', 'naloxona'], 'vigilar.llamar': ['telefono', 'telefono'],
  'vomito.de_lado': ['cadera', 'lado'], 'vomito.seguir': ['piernas', 'reloj'],
  'esperar.quedarse': ['pecho', 'ojo'], 'esperar.llamar': ['telefono', 'telefono'],
};
for (const n of nodos) {
  n.fase = (Object.keys(FASE_DE) as Fase[]).find((f) => FASE_DE[f].includes(n.id));
  if (PISTA_DE[n.id]) n.pistaKey = PISTA_DE[n.id];
  for (const o of n.options ?? []) {
    const v = VISUAL[`${n.id}.${o.id}`];
    if (v) { o.ancla = v[0]; o.icono = v[1]; }
  }
}

export const ARBOL: DecisionTree = {
  id: 'respuesta_sobredosis_v1',
  inicio: 'aviso',
  nodes: nodos,
  interrupciones: {
    arrest: 'paro',
    rosc: 'pulso',
    vomit: 'vomito',
    awake: 'despierta',
    ems: 'resultado',
    death: 'resultado',
    timeout: 'resultado',
  },
};
