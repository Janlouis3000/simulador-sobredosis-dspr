// Lo que la persona usuaria observa, calculado con el motor. Mismos umbrales que los textos de signos de ui.js.
import { derived } from '../engine';
import type { Sim } from '../engine';
import { CLINICA } from './config/clinica';
import type { Clasificacion, Observacion } from './tipos';

export function clasificarRespuesta(s: Sim): Clasificacion {
  return derived(s).cons === 3 && !s.arrest ? 'responde' : 'no_responde';
}

/** propia = false: ¿respira normalmente? propia = true: ¿respira por su cuenta? (después de la naloxona). */
export function clasificarRespiracion(s: Sim, propia = false): Clasificacion {
  if (s.arrest) return 'no_respira';
  const min = propia ? CLINICA.respiracionPropiaMinRpm : CLINICA.respiracionNormalMinRpm;
  return Math.round(derived(s).rr) >= min ? 'respira_normal' : 'respira_anormal';
}

export function obsRespuesta(s: Sim): Observacion {
  const cons = derived(s).cons;
  return { t: s.t, clave: ['obs.respuesta.nada', 'obs.respuesta.dolor', 'obs.respuesta.somnolienta', 'obs.respuesta.despierta'][cons] ?? 'obs.respuesta.nada' };
}

export function obsRespiracion(s: Sim): Observacion {
  if (s.arrest) return { t: s.t, clave: 'obs.respiracion.jadea' };
  const n = Math.round(derived(s).rr);
  if (n < 2) return { t: s.t, clave: 'obs.respiracion.casi_nada' };
  if (n < CLINICA.respiracionMuyLentaRpm) return { t: s.t, clave: 'obs.respiracion.muy_lenta', vars: { n } };
  if (n < CLINICA.respiracionNormalMinRpm) return { t: s.t, clave: 'obs.respiracion.lenta', vars: { n } };
  return { t: s.t, clave: 'obs.respiracion.normal', vars: { n } };
}

export function obsSonido(s: Sim): Observacion {
  const d = derived(s);
  if (s.arrest) return { t: s.t, clave: 'obs.sonido.jadeos' };
  if (s.aspirated && s.vomitAt !== null && s.t - s.vomitAt < 90) return { t: s.t, clave: 'obs.sonido.gorgoteo' };
  if (d.rr < CLINICA.respiracionMuyLentaRpm && d.cons <= 1)
    return { t: s.t, clave: s.position === 'lado' || s.airwayOpen ? 'obs.sonido.debil' : 'obs.sonido.ronca' };
  return { t: s.t, clave: 'obs.sonido.normal' };
}

export function obsPupilas(s: Sim): Observacion {
  const mm = derived(s).pupil;
  const v = { mm: mm.toFixed(1) };
  if (mm < 1.8) return { t: s.t, clave: 'obs.pupilas.puntiformes', vars: v };
  if (mm < 2.8) return { t: s.t, clave: 'obs.pupilas.pequenas', vars: v };
  return { t: s.t, clave: 'obs.pupilas.normales', vars: v };
}

export function obsColor(s: Sim): Observacion {
  if (s.o2 < 75) return { t: s.t, clave: 'obs.color.morado' };
  if (s.o2 < 88) return { t: s.t, clave: 'obs.color.palido' };
  return { t: s.t, clave: 'obs.color.normal' };
}

/** Segundos que faltan para poder dar otra dosis según el criterio configurado (0 si ya se puede). */
export function faltaParaDosis(s: Sim): number {
  const ultima = s.doses[s.doses.length - 1];
  if (!ultima) return 0;
  return Math.max(0, CLINICA.intervaloSegundaDosisS - (s.t - ultima.t));
}
