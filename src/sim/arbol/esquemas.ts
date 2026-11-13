// Esquemas Zod del contenido: árbol, casos y perfiles de diálogo. validar.ts los usa antes de revisar el grafo.
import { z } from 'zod';

// Sin el modo JIT de Zod (usa new Function): la política de seguridad del sitio (CSP) prohíbe eval.
z.config({ jitless: true });

const id = z.string().regex(/^[a-z0-9_]+$/, 'solo minúsculas, números y _');
const clave = z.string().min(3);
const perfil = z.enum(['cpr_trained', 'basic_responder', 'unsure']);
const accionCritica = z.enum(['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'naloxona', 'abrir_via_aerea', 'apoyo_respiratorio', 'rcp', 'posicion_lateral', 'vigilar', 'no_dejar_sola', 'segunda_dosis']);
const clasificacion = z.enum(['responde', 'no_responde', 'respira_normal', 'respira_anormal', 'no_respira']);

export const EsquemaOpcion = z.object({
  id,
  labelKey: clave,
  next: id,
  feedbackKey: clave.optional(),
  calidad: z.enum(['correcta', 'aceptable', 'incorrecta']),
  perfiles: z.array(perfil).min(1).optional(),
  ancla: z.enum(['cabeza', 'ojos', 'boca', 'pecho', 'cadera', 'mano', 'piernas', 'telefono', 'kit']).optional(),
  icono: z.enum(['mano', 'voz', 'ojo', 'respirar', 'telefono', 'naloxona', 'corazon', 'lado', 'reloj', 'gota', 'via']).optional(),
  requiere: z.array(z.enum(['intervalo_dosis_cumplido', 'quedan_dispositivos', 'sin_911', 'con_911', 'no_responde', 'sin_naloxona', 'dosis_extra_si_respira'])).optional(),
  effects: z.object({
    elapsedSeconds: z.number().int().nonnegative().optional(),
    accionMotor: z.enum(['none', 'breaths', 'cpr']).optional(),
    llamar911: z.boolean().optional(),
    abrirViaAerea: z.boolean().optional(),
    posicion: z.enum(['espalda', 'lado']).optional(),
    dosisNueva: z.boolean().optional(),
    mito: z.boolean().optional(),
    irse: z.boolean().optional(),
    esperarEms: z.boolean().optional(),
    clinicalSafety: z.number().optional(),
    communication: z.number().optional(),
    requiredActions: z.array(accionCritica).optional(),
    flags: z.array(id).optional(),
  }).strict().optional(),
}).strict();

export const EsquemaNodo = z.object({
  id,
  type: z.enum(['information', 'assessment', 'choice', 'naloxone_practice', 'cpr_practice', 'dialogue', 'outcome']),
  promptKey: clave,
  promptKeyPorPerfil: z.partialRecord(perfil, clave).optional(),
  options: z.array(EsquemaOpcion).optional(),
  next: id.optional(),
  evalua: z.enum(['respuesta', 'respiracion', 'respiracion_propia']).optional(),
  routes: z.partialRecord(clasificacion, id).optional(),
  requiere911: z.boolean().optional(),
  esPrimeraDosis: z.boolean().optional(),
  requiereRevisionClinica: z.boolean().optional(),
  fase: z.enum(['evaluar', 'ayuda', 'apoyo', 'despertar']).optional(),
  pistaKey: clave.optional(),
}).strict();

export const EsquemaArbol = z.object({
  id,
  inicio: id,
  nodes: z.array(EsquemaNodo).min(1),
  interrupciones: z.partialRecord(z.enum(['arrest', 'rosc', 'vomit', 'awake', 'ems', 'death', 'timeout']), id),
}).strict();

export const EsquemaCaso = z.object({
  id,
  motor: z.enum(['fentanilo', 'pastillas', 'xilazina', 'tardio']),
  tituloKey: clave,
  introKey: clave,
  lugarKey: clave,
  persona: z.object({ tipo: z.enum(['h', 'm', 'a', 'v']), genero: z.enum(['m', 'f']) }),
  dialogo: id,
  objetivos: z.array(z.object({ id, textKey: clave })),
  accionesCriticas: z.array(accionCritica).min(1),
  dosisExtraSiRespira: z.boolean(),
  revision: z.object({ estado: z.enum(['pendiente', 'aprobado']), fecha: z.string().nullable(), revisadoPor: z.string().nullable(), fuentes: z.array(z.string()) }),
});

const texto = z.string().min(1);
export const EsquemaDialogo = z.object({
  lo: z.enum(['lo', 'la']),
  variantes: z.array(z.object({ emocion: z.string(), agit: z.number().min(0).max(100), escena: texto, dice: texto })).min(1),
  turnos: z.array(z.object({
    alta: texto.optional(),
    baja: texto.optional(),
    o: z.array(z.object({ t: texto, d: z.number(), ok: z.enum(['ok', 'mid', 'no']), fb: texto, accion: z.enum(['dosis', 'llamar', 'irse', 'cancelar']).optional() })).min(2),
  })).min(1),
  fin: z.object({ calma: texto, malaGana: texto, seVa: texto, calmaSinAmbulancia: texto.optional() }),
});
