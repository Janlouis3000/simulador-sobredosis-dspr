// Tipos del simulador con árbol de decisiones (prueba vertical, fase 2).
// Los identificadores internos (id) nunca dependen del texto que se muestra: los textos se buscan por clave
// en src/content/locales/<idioma>.json.
import type { AccionMotor, CaseId, Desenlace, EventoMotor, Sim } from '../engine';

export type TrainingProfile = 'cpr_trained' | 'basic_responder' | 'unsure';
export const PERFILES: readonly TrainingProfile[] = ['cpr_trained', 'basic_responder', 'unsure'];

export type Genero = 'm' | 'f';

/** Acciones críticas que el informe final revisa. */
export type AccionCritica =
  | 'comprobar_respuesta'
  | 'evaluar_respiracion'
  | 'llamar_911'
  | 'naloxona'
  | 'abrir_via_aerea'
  | 'apoyo_respiratorio'
  | 'rcp'
  | 'posicion_lateral'
  | 'vigilar'
  | 'no_dejar_sola'
  | 'segunda_dosis';

/** Clasificaciones que un nodo de evaluación puede devolver. Las calcula sim/observaciones.ts con el motor. */
export type Clasificacion =
  | 'responde' | 'no_responde'
  | 'respira_normal' | 'respira_anormal' | 'no_respira';

export type Condicion =
  | 'intervalo_dosis_cumplido'
  | 'quedan_dispositivos'
  | 'sin_911'
  | 'con_911'
  | 'no_responde'
  /** Todavía no se ha usado ningún dispositivo de naloxona. */
  | 'sin_naloxona'
  /** El caso permite otra dosis a quien ya respira por su cuenta pero no despierta (no en xilazina). */
  | 'dosis_extra_si_respira'
  /** La vía aérea ya está abierta: se abrió (airwayOpen) o la persona está de lado (posición de rescate). */
  | 'via_aerea_abierta';

export interface DecisionEffect {
  elapsedSeconds?: number;
  /** Lo que hace el motor mientras pasa ese tiempo. */
  accionMotor?: AccionMotor;
  llamar911?: boolean;
  abrirViaAerea?: boolean;
  posicion?: 'espalda' | 'lado';
  /** Otra dosis con un dispositivo nuevo (la primera se da en el nodo de práctica de naloxona). */
  dosisNueva?: boolean;
  mito?: boolean;
  /** La persona usuaria se va del lugar: el motor sigue solo hasta el final. */
  irse?: boolean;
  /** Esperar a la ambulancia: el motor avanza hasta que llega o hasta otro evento. */
  esperarEms?: boolean;
  clinicalSafety?: number;
  communication?: number;
  requiredActions?: AccionCritica[];
  flags?: string[];
}

export type Calidad = 'correcta' | 'aceptable' | 'incorrecta';

/** Parte del cuerpo u objeto de la escena 3D sobre el que se dibuja el icono de una opción (Scene3D.anclas). */
export type Ancla = 'cabeza' | 'ojos' | 'boca' | 'pecho' | 'cadera' | 'mano' | 'piernas' | 'telefono' | 'kit';
export type Icono = 'mano' | 'voz' | 'ojo' | 'respirar' | 'telefono' | 'naloxona' | 'corazon' | 'lado' | 'reloj' | 'gota' | 'via';
/** Fases del caso: al pasar de una a la siguiente se muestra un resumen de lo que se hizo. */
export type Fase = 'evaluar' | 'ayuda' | 'apoyo' | 'despertar';
export const FASES: readonly Fase[] = ['evaluar', 'ayuda', 'apoyo', 'despertar'];
/** Guiado: pistas y explicación después de cada decisión. Sin guía: las explicaciones llegan al final de cada fase. */
export type Modo = 'guiado' | 'sin_guia';

export interface DecisionOption {
  id: string;
  labelKey: string;
  next: string;
  effects?: DecisionEffect;
  feedbackKey?: string;
  calidad: Calidad;
  /** Si existe, la opción solo aparece en esos perfiles. */
  perfiles?: TrainingProfile[];
  /** Todas deben cumplirse para que la opción aparezca. */
  requiere?: Condicion[];
  /** Dónde va su icono en la escena 3D. Sin ancla, la opción solo aparece en la lista. */
  ancla?: Ancla;
  icono?: Icono;
}

export type TipoNodo =
  | 'information'
  | 'assessment'
  | 'choice'
  | 'naloxone_practice'
  | 'cpr_practice'
  | 'dialogue'
  | 'outcome';

export interface DecisionNode {
  id: string;
  type: TipoNodo;
  promptKey: string;
  /** Texto distinto según el perfil de capacitación (por ejemplo, lo que dice el operador del 9-1-1). */
  promptKeyPorPerfil?: Partial<Record<TrainingProfile, string>>;
  options?: DecisionOption[];
  next?: string;
  /**
   * Solo en nodos assessment. "respiracion": ¿respira normalmente? (evaluación inicial). "respiracion_propia":
   * ¿respira por su cuenta? (reevaluación después de la naloxona); usa las mismas rutas.
   */
  evalua?: 'respuesta' | 'respiracion' | 'respiracion_propia';
  routes?: Partial<Record<Clasificacion, string>>;
  /** Si se cumple esta condición al llegar, el paso no se muestra y se sigue a `omitirA` (no se repite lo ya hecho). */
  omitirSi?: Condicion;
  omitirA?: string;
  /** Las opciones de este nodo que terminan el caso exigen haber llamado al 9-1-1 (lo revisa el validador). */
  requiere911?: boolean;
  /** Nodo de dosis: el validador revisa que las dosis adicionales cumplan el criterio. */
  esPrimeraDosis?: boolean;
  requiereRevisionClinica?: boolean;
  fase?: Fase;
  /** Pista del modo guiado (un texto que ya existe en el contenido; no agrega información clínica). */
  pistaKey?: string;
}

export interface DecisionTree {
  id: string;
  inicio: string;
  nodes: DecisionNode[];
  /** Nodo al que se salta cuando el motor produce un evento en medio de una acción. */
  interrupciones: Partial<Record<EventoMotor, string>>;
}

export interface LearningObjective { id: string; textKey: string }

export interface RevisionClinica {
  estado: 'pendiente' | 'aprobado';
  fecha: string | null;
  revisadoPor: string | null;
  fuentes: string[];
}

export interface CaseDefinition {
  id: string;
  motor: CaseId;
  tituloKey: string;
  introKey: string;
  lugarKey: string;
  persona: { tipo: 'h' | 'm' | 'a' | 'v'; genero: Genero };
  dialogo: string;
  objetivos: LearningObjective[];
  accionesCriticas: AccionCritica[];
  /**
   * ¿Se ofrece otra dosis a quien ya respira por su cuenta pero no despierta? La guía de NARCAN dice que sí; en
   * xilazina el contenido aprobado dice que no se busquen más dosis. REQUIERE REVISIÓN CLÍNICA.
   */
  dosisExtraSiRespira: boolean;
  revision: RevisionClinica;
}

export interface ClinicalConfig {
  revision: RevisionClinica;
  intervaloSegundaDosisS: number;
  dispositivosEnKit: number;
  respiracionNormalMinRpm: number;
  respiracionMuyLentaRpm: number;
  respiracionPropiaMinRpm: number;
  tiempos: {
    seguridadEscena: number;
    comprobarRespuesta: number;
    mirarPupilas: number;
    evaluarRespiracion: number;
    llamar911: number;
    administrarNaloxona: number;
    abrirViaAerea: number;
    respiracionesRescate: number;
    rcp: number;
    posicionLateral: number;
    vigilar: number;
    vigilarDespierta: number;
    aguaFria: number;
    dejarDormir: number;
    esperarSinActuar: number;
    pasoEsperaEms: number;
  };
  rutaBasica: { accionMotorCompresionesGuiadas: AccionMotor; requiereRevision: true };
  dialogo: {
    turnos: number;
    lineaAlta: number;
    etiquetaMuyAlta: number;
    etiquetaBaja: number;
    maxima: number;
    turnoMinimoParaIrse: number;
    calma: number;
  };
}

// ---------- Diálogo al despertar (estructura de DESPERTAR en content.js) ----------
export type AccionDialogo = 'dosis' | 'llamar' | 'irse' | 'cancelar';
export interface DialogueOption { t: string; d: number; ok: 'ok' | 'mid' | 'no'; fb: string; accion?: AccionDialogo }
export interface DialogueTurn { alta?: string; baja?: string; o: DialogueOption[] }
export interface DialogueVariant { emocion: string; agit: number; escena: string; dice: string }
export interface DialogueProfile {
  lo: 'lo' | 'la';
  variantes: DialogueVariant[];
  turnos: DialogueTurn[];
  fin: { calma: string; malaGana: string; seVa: string; calmaSinAmbulancia?: string };
}

// ---------- Naloxona ----------
export interface NaloxoneStep {
  id: string;
  textKey: string;
  altKey: string;
  ilustracion: string;
  requiereRevisionClinica?: boolean;
}

/** Modelos 3D opcionales de la demostración. Sin URLs se usa la secuencia ilustrada. */
export interface NaloxoneVisualAsset {
  deviceModelUrl?: string;
  headModelUrl?: string;
  handModelUrl?: string;
  fallbackImages: string[];
}

// ---------- Recursos ----------
export interface ContactResource {
  id: string;
  labelKey: string;
  value: string;
  href: string;
  type: 'phone' | 'email' | 'url';
  availabilityKey?: string;
}

// ---------- Partida y resultado ----------
export interface EntradaRegistro {
  t: number;
  nodo: string;
  opcion: string;
  calidad: Calidad;
  feedbackKey?: string;
  /** Respuestas de la conversación y de la práctica de naloxona: su texto viene en los datos (content.js). */
  texto?: { opcion: string; fb: string };
  perfil: TrainingProfile;
}

export interface Observacion { t: number; clave: string; vars?: Record<string, string | number> }

export interface EstadoDialogo {
  variante: number;
  turno: number;
  agitacion: number;
  orden: number[];
  ultima?: { opcion: number; seVa: boolean };
  fin?: 'calma' | 'malaGana' | 'seVa' | 'dejar';
  malas: number;
  cancelo: boolean;
}

export interface Partida {
  casoId: string;
  perfil: TrainingProfile;
  nodo: string;
  sim: Sim;
  registro: EntradaRegistro[];
  acciones: AccionCritica[];
  flags: string[];
  dispositivosUsados: number;
  observaciones: Observacion[];
  /** Evento del motor que interrumpió la última acción, para anunciarlo. */
  ultimoEvento: EventoMotor | null;
  dialogo: EstadoDialogo | null;
  terminada: boolean;
  fin: 'ems' | 'muerte' | 'tiempo' | 'irse' | 'dejar' | 'seVa' | null;
}

export interface FeedbackItem {
  id: string;
  textKey: string;
  vars?: Record<string, string | number>;
}

export interface SimulationResult {
  desenlace: Desenlace | 'riesgo';
  perfil: TrainingProfile;
  completadas: FeedbackItem[];
  reforzar: FeedbackItem[];
  practicadas: FeedbackItem[];
  tiempos: { llamada: number | null; primeraDosis: number | null; primerApoyo: number | null; total: number };
  mensajeCentralKey: string;
  revision: RevisionClinica;
}
