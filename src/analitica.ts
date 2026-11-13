// Adaptador de analítica, desacoplado y DESACTIVADO por omisión: la aplicación funciona igual sin él.
// Solo eventos agregados y datos no identificables (caso, perfil, desenlace, id de una acción). Nunca nombres,
// ubicación, información médica personal ni el texto de las decisiones.
export type EventoAnalitica =
  | 'scenario_started'
  | 'scenario_completed'
  | 'scenario_repeated'
  | 'naloxone_demo_started'
  | 'naloxone_demo_completed'
  | 'critical_action_missed'
  | 'accessibility_mode_enabled';

export type DatosAnalitica = Record<string, string | number | boolean>;

export interface AdaptadorAnalitica {
  enviar(evento: EventoAnalitica, datos?: DatosAnalitica): void;
}

const desactivada: AdaptadorAnalitica = { enviar: () => {} };
let actual: AdaptadorAnalitica = desactivada;

/** Para conectar un servicio (por ejemplo, uno del Departamento). Sin llamarla, no se envía nada. */
export function configurarAnalitica(a: AdaptadorAnalitica | null): void {
  actual = a ?? desactivada;
}

export function registrar(evento: EventoAnalitica, datos?: DatosAnalitica): void {
  try {
    actual.enviar(evento, datos);
  } catch {
    // La analítica nunca interrumpe la simulación.
  }
}
