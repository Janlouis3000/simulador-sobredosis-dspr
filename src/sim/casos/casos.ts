// Los cuatro casos del simulador con árbol. Cada caso es solo configuración del mismo árbol y del mismo motor:
// los valores fisiológicos están en engine.js (CASES) y no cambiaron. Las lecciones de cada caso se muestran
// desde CASE_INFO (content.js), igual que en el simulador clásico.
import { CLINICA } from '../config/clinica';
import type { CaseDefinition, LearningObjective } from '../tipos';

const OBJETIVOS: LearningObjective[] = [
  { id: 'reconocer', textKey: 'objetivo.reconocer' },
  { id: 'llamar', textKey: 'objetivo.llamar' },
  { id: 'naloxona', textKey: 'objetivo.naloxona' },
  { id: 'respirar', textKey: 'objetivo.respirar' },
  { id: 'quedarse', textKey: 'objetivo.quedarse' },
];

const textos = (id: string) => ({ tituloKey: `caso.${id}.titulo`, introKey: `caso.${id}.intro`, lugarKey: `caso.${id}.lugar` });

export const FENTANILO: CaseDefinition = {
  id: 'fentanilo', motor: 'fentanilo', ...textos('fentanilo'),
  persona: { tipo: 'h', genero: 'm' },
  dialogo: 'nota',
  objetivos: OBJETIVOS,
  accionesCriticas: ['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'naloxona', 'abrir_via_aerea', 'apoyo_respiratorio', 'posicion_lateral', 'no_dejar_sola'],
  dosisExtraSiRespira: true,
  revision: CLINICA.revision,
};

export const PASTILLAS: CaseDefinition = {
  id: 'pastillas', motor: 'pastillas', ...textos('pastillas'),
  persona: { tipo: 'a', genero: 'f' },
  dialogo: 'joven',
  objetivos: OBJETIVOS,
  accionesCriticas: ['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'naloxona', 'abrir_via_aerea', 'apoyo_respiratorio', 'posicion_lateral', 'no_dejar_sola'],
  dosisExtraSiRespira: true,
  revision: CLINICA.revision,
};

// Xilazina: la naloxona no revierte la xilazina, pero se da igual (CDC). La persona puede respirar bien y seguir
// dormida: no se buscan más dosis; posición de rescate y vigilar (lección del caso en content.js).
export const XILAZINA: CaseDefinition = {
  id: 'xilazina', motor: 'xilazina', ...textos('xilazina'),
  persona: { tipo: 'h', genero: 'm' },
  dialogo: 'nota',
  objetivos: [...OBJETIVOS, { id: 'xilazina', textKey: 'objetivo.xilazina' }],
  accionesCriticas: ['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'naloxona', 'abrir_via_aerea', 'apoyo_respiratorio', 'posicion_lateral', 'no_dejar_sola'],
  dosisExtraSiRespira: false,
  revision: CLINICA.revision,
};

// Adulto mayor en paro: no respira, solo jadea. La RCP va de inmediato (AHA 2025).
export const TARDIO: CaseDefinition = {
  id: 'tardio', motor: 'tardio', ...textos('tardio'),
  persona: { tipo: 'v', genero: 'm' },
  dialogo: 'mayor',
  objetivos: [...OBJETIVOS, { id: 'rcp_inmediata', textKey: 'objetivo.rcp_inmediata' }],
  accionesCriticas: ['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'rcp', 'naloxona', 'posicion_lateral', 'no_dejar_sola'],
  dosisExtraSiRespira: true,
  revision: CLINICA.revision,
};

export const CASOS_ARBOL: Record<string, CaseDefinition> = { fentanilo: FENTANILO, pastillas: PASTILLAS, xilazina: XILAZINA, tardio: TARDIO };
