// Traduce la partida al estado que dibuja la escena 3D (Scene3D.update). Las mismas reglas del simulador clásico
// (render y poseName en ui.js): pose, respiración, cianosis, pupilas, teléfono, dosis usadas y conducta al despertar.
import { derived } from '../engine';
import type { AccionMotor } from '../engine';
import type { DialogueProfile, Partida } from '../sim/tipos';

export type Pose = 'supine' | 'open' | 'side' | 'sitting';

export interface EstadoEscena {
  pose: Pose;
  anim: AccionMotor;
  rr: number;
  arrest: boolean;
  cyan: number;
  cons: number;
  vomit: boolean;
  phone: boolean;
  dosesUsed: number;
  pupil: number;
  agit: number;
  emocion: string | null;
}

export function poseDe(p: Partida, anim: AccionMotor): Pose {
  const s = p.sim;
  if (derived(s).cons === 3 && !s.arrest) return 'sitting';
  if (s.position === 'lado') return 'side';
  if (s.airwayOpen || anim !== 'none') return 'open';
  return 'supine';
}

export function estadoEscena(p: Partida, anim: AccionMotor, dialogo: DialogueProfile | undefined): EstadoEscena {
  const s = p.sim, d = derived(s);
  const variante = p.dialogo ? dialogo?.variantes[p.dialogo.variante] : undefined;
  return {
    pose: poseDe(p, anim),
    anim,
    rr: s.arrest ? 0 : d.rr,
    arrest: s.arrest,
    cyan: Math.max(0, Math.min(1, (92 - s.o2) / 42)),
    cons: d.cons,
    vomit: s.vomitAt !== null && s.t - s.vomitAt < 600,
    phone: s.called911 !== null,
    dosesUsed: s.doses.length,
    pupil: d.pupil,
    agit: (p.dialogo?.agitacion ?? 0) / 100,
    emocion: p.dialogo ? (p.dialogo.fin === 'calma' ? 'gratitud' : variante?.emocion ?? null) : null,
  };
}
