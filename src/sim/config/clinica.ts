// Configuración clínica central y revisable. Todo número que cambie lo que se enseña vive aquí.
// REQUIERE REVISIÓN CLÍNICA: ningún valor de este archivo está aprobado todavía por la persona a cargo.
// Cada valor dice de dónde sale. Los que ya existían en el simulador conservan el mismo número.
import type { ClinicalConfig } from '../tipos';

export const CLINICA: ClinicalConfig = {
  revision: {
    estado: 'pendiente',
    fecha: null,
    revisadoPor: null,
    fuentes: [
      'DSPR: cápsula "Administración correcta de la naloxona", afiche "Identifica, actúa y salva una vida" y folleto de naloxona',
      'NARCAN, guía de inicio rápido y hoja de datos en español (Emergent, 2025-2026)',
      'AHA 2025: si no respira o solo jadea, RCP sin demorarla por la naloxona',
      'CDC: la naloxona no revierte la xilazina, pero se administra igual',
    ],
  },

  // DSPR: esperar 3 minutos antes de una segunda dosis. La guía de NARCAN dice 2 a 3 minutos.
  // El simulador clásico avisaba antes de 170 s; aquí se usa el valor del protocolo DSPR. REQUIERE REVISIÓN CLÍNICA.
  intervaloSegundaDosisS: 180,

  // El kit del simulador tiene 2 dispositivos (DOSES en engine.js). NARCAN dice que es seguro seguir dando dosis.
  dispositivosEnKit: 2,

  // Clasificación de la respiración, tomada de breathingText en ui.js: 12 o más por minuto es "normal";
  // menos de 8 es "muy lenta". REQUIERE REVISIÓN CLÍNICA como regla de decisión del árbol.
  respiracionNormalMinRpm: 12,
  respiracionMuyLentaRpm: 8,
  // Reevaluación después de la naloxona: "respira por su cuenta" (ponerla de lado y vigilar) desde 8 por minuto,
  // el mismo límite de ui.js entre "muy lenta" y "lenta pero presente". Con 12 la ruta de la posición lateral
  // era casi inalcanzable: la persona despierta antes de llegar a 12. REQUIERE REVISIÓN CLÍNICA.
  respiracionPropiaMinRpm: 8,

  // Segundos simulados de cada acción: los mismos de doAction en ui.js, salvo los nuevos marcados.
  tiempos: {
    seguridadEscena: 5, // nuevo: el protocolo DSPR no incluye este paso. REQUIERE REVISIÓN CLÍNICA
    comprobarRespuesta: 10,
    mirarPupilas: 5,
    evaluarRespiracion: 10,
    llamar911: 20,
    administrarNaloxona: 15,
    abrirViaAerea: 10,
    respiracionesRescate: 60,
    rcp: 120,
    posicionLateral: 15,
    vigilar: 60,
    vigilarDespierta: 120,
    aguaFria: 45,
    dejarDormir: 120,
    esperarSinActuar: 60, // nuevo: opción incorrecta "esperar a ver si reacciona"
    pasoEsperaEms: 30,
  },

  // Ruta sin capacitación en RCP: el operador del 9-1-1 guía las compresiones. El motor no tiene un modelo de
  // RCP solo con compresiones, así que por ahora se simula como la RCP del motor. REQUIERE REVISIÓN CLÍNICA.
  rutaBasica: { accionMotorCompresionesGuiadas: 'cpr', requiereRevision: true },

  // Conversación al despertar: los mismos umbrales que openAwake en ui.js. REQUIERE REVISIÓN CLÍNICA.
  dialogo: {
    turnos: 3,
    lineaAlta: 60, // con 60 o más, la persona dice su línea "alta"
    etiquetaMuyAlta: 70, // "Muy alterado/a"
    etiquetaBaja: 40, // por debajo: "Más tranquilo/a"
    maxima: 100, // se va si llega aquí...
    turnoMinimoParaIrse: 1, // ...desde el segundo turno (índice 1): una sola mala respuesta no basta
    calma: 35, // al final, 35 o menos: se calma y se queda
  },
};
