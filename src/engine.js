// Motor fisiológico simplificado para entrenamiento comunitario (no clínico).
// Tiempo en segundos simulados.
const CASES = {
  fentanilo:  { o2: 82, opioid: 0.74, rise: 0.00055, cap: 0.97, xyl: 0,    damage: 0,  label: 'Fentanilo' },
  pastillas:  { o2: 86, opioid: 0.66, rise: 0.00045, cap: 0.90, xyl: 0,    damage: 0,  label: 'Pastillas' },
  xilazina:   { o2: 80, opioid: 0.62, rise: 0.00040, cap: 0.85, xyl: 0.55, damage: 0,  label: 'Xilazina + fentanilo' },
  tardio:     { o2: 40, opioid: 0.95, rise: 0.00020, cap: 0.99, xyl: 0,    damage: 15, arrest: true, label: 'Hallazgo tardío' },
};

const EMS_DELAY = 480;       // 8 min desde la llamada
const T_LIMIT = 1200;        // 20 min
const DOSES = 2;
// Ajuste de presentación, no clínico: segundos simulados mínimos entre una dosis y el aviso de vómito, para que
// primero se vea la administración y después el episodio. Se cambia por simulación con s.vomitDelay.
const VOMIT_DELAY = 5;

function createSim(caseId) {
  const c = CASES[caseId];
  return {
    caseId, t: 0, o2: c.o2, opioid: c.opioid, rise: c.rise, cap: c.cap, xyl: c.xyl,
    damage: c.damage, lowO2: 0,
    doses: [], position: 'espalda', airwayOpen: false, hist: [[0, c.o2, 0, !!c.arrest]],
    called911: null, checkedResp: null, checkedBreath: null, firstVent: null,
    arrest: !!c.arrest, arrestAt: c.arrest ? 0 : null, arrestNoCpr: 0, cprInArrest: 0, rosc: null,
    vomitAt: null, vomitPending: null, vomitDelay: VOMIT_DELAY, vomitHandled: false, aspirated: false,
    awakeAt: null, awakeChoice: null, left: false,
    myths: 0, unneeded: [], log: [], ended: false, outcome: null,
    critSeconds: 0,
  };
}

function naloxBlock(s, t) {
  let b = 0;
  for (const d of s.doses) {
    const dt = typeof d === 'number' ? d : d.t;
    const f = typeof d === 'number' ? 1 : d.f;
    const x = (t - dt - 30) / 90; // efecto comienza a los 30 s, completo a los 2 min
    b += 0.62 * f * Math.max(0, Math.min(1, x));
  }
  return Math.min(0.96, b);
}

// Hora de la última dosis que entró (f > 0). Una dosis desperdiciada (f = 0) no cuenta.
function lastEffectiveDose(s) {
  let t = null;
  for (const d of s.doses) {
    const dt = typeof d === 'number' ? d : d.t, f = typeof d === 'number' ? 1 : d.f;
    if (f > 0 && dt <= s.t && (t === null || dt > t)) t = dt;
  }
  return t;
}

function derived(s) {
  const eff = s.opioid * (1 - naloxBlock(s, s.t));
  const dResp = eff + s.xyl * 0.35;
  const dCons = eff + s.xyl;
  let rr = s.arrest ? 0 : Math.max(0, 16 * (1 - dResp));
  if (!s.arrest && s.o2 < 45) rr = Math.min(rr, 2);
  let cons;
  if (s.arrest) cons = 0;
  else if (dCons < 0.2 && s.o2 > 70) cons = 3;      // despierto
  else if (dCons < 0.45 && s.o2 > 65) cons = 2;     // somnoliento
  else if (dCons < 0.65 && s.o2 > 60) cons = 1;     // responde al dolor
  else cons = 0;
  // Pupilas: puntiformes con efecto opioide alto; se agrandan al revertirse
  const pupil = 1.1 + 2.9 * (1 - Math.min(1, eff / 0.55));
  return { eff, rr, cons, pupil, block: naloxBlock(s, s.t) };
}

// action: 'none' | 'breaths' | 'cpr'
function step(s, action) {
  const d = derived(s);
  // Ventilación
  let v;
  if (s.arrest) {
    v = action === 'cpr' ? 0.66 : 0;
  } else {
    const airway = (s.position === 'lado' || s.airwayOpen || d.cons >= 2) ? 1.0 : 0.72;
    v = Math.min(1, d.rr / 12) * airway;
    if (action === 'breaths') v = Math.max(v, 0.88);
    if (action === 'cpr') v = Math.max(v, 0.7);
  }
  const target = s.arrest && action !== 'cpr' ? 5 : 24 + 74 * v;
  const k = target < s.o2 ? 0.013 : 0.045;
  s.o2 += (target - s.o2) * k;
  s.o2 = Math.max(0, Math.min(99, s.o2));
  // Daño por hipoxia
  if (s.o2 < 75) s.damage += 1.5 * (75 - s.o2) / 75;
  if (s.arrest && action !== 'cpr') { s.damage += 0.5; s.arrestNoCpr += 1; }
  if (s.arrest && action === 'cpr') {
    s.cprInArrest += 1;
    // Retorno de pulso: RCP sostenida + naloxona en efecto (paro de origen respiratorio)
    if (s.cprInArrest >= 120 && naloxBlock(s, s.t) >= 0.5) { s.arrest = false; s.rosc = s.t; s.lowO2 = 0; s.o2 = Math.max(s.o2, 60); }
  }
  if (s.o2 < 85) s.critSeconds += 1;
  // Paro cardíaco por hipoxia sostenida
  if (!s.arrest) {
    if (s.o2 < 40) s.lowO2 += 1; else s.lowO2 = Math.max(0, s.lowO2 - 2);
    if (s.lowO2 >= 45) { s.arrest = true; s.arrestAt = s.t; }
  }
  // Absorción continua del opioide
  s.opioid = Math.min(s.cap, s.opioid + s.rise);
  s.t += 1;
  if (s.t % 5 === 0) { const dd = derived(s); s.hist.push([s.t, Math.round(s.o2), Math.round(dd.rr * 10) / 10, s.arrest]); }
}

// Avanza n segundos con una acción; se detiene al final del primer segundo en que ocurre algún evento.
// Devuelve los eventos de ese segundo, en orden fijo: primero, a lo sumo, uno que no termina el caso
// (prioridad: arrest, rosc, vomit, awake) y después, a lo sumo, uno que lo termina (prioridad: ems, death,
// timeout). Así, si la ambulancia llega en el mismo segundo en que la persona vomita o despierta, el aviso de
// 'ems' sale en esa misma llamada y no en la siguiente. Entre los eventos que no terminan se conserva la
// prioridad de la v2: si dos coinciden, solo se informa el primero.
//
// Vómito: se desencadena cuando la persona pasa de no responder a responder (cons 0 → 1 o más) con al menos una
// dosis que entró (f > 0); una dosis desperdiciada no lo desencadena por sí sola. Ocurre una sola vez. Si el
// desencadenante llega antes de que pasen s.vomitDelay segundos desde la última dosis, el aviso espera hasta
// entonces (vomitPending): así primero se ve la administración y después el episodio. Si entra en paro antes, se
// descarta. Ninguno de los escenarios de calibración cae en esa espera, así que sus valores no cambian.
function advance(s, n, action) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const before = derived(s);
    const wasArrest = s.arrest;
    step(s, action);
    const after = derived(s);
    if (s.arrest) s.vomitPending = null;
    // Como en la v2, el desencadenante no se mira en un segundo con paro o retorno del pulso (tienen prioridad).
    if (wasArrest === s.arrest && s.vomitAt === null && s.vomitPending === null && before.cons === 0 && after.cons >= 1) {
      const ultima = lastEffectiveDose(s);
      if (ultima !== null) s.vomitPending = Math.max(s.t, ultima + (s.vomitDelay ?? VOMIT_DELAY));
    }
    if (!wasArrest && s.arrest) events.push('arrest');
    else if (wasArrest && !s.arrest) events.push('rosc');
    else if (s.vomitAt === null && s.vomitPending !== null && s.t >= s.vomitPending) {
      s.vomitAt = s.t; s.vomitPending = null;
      if (s.position === 'lado') s.vomitHandled = true;
      events.push('vomit');
    } else if (s.awakeAt === null && after.cons === 3) { s.awakeAt = s.t; events.push('awake'); }
    if (s.called911 !== null && s.t >= s.called911 + EMS_DELAY) events.push('ems');
    else if (s.arrest && s.arrestNoCpr >= 240) events.push('death');
    else if (s.damage >= 300) events.push('death');
    else if (s.t >= T_LIMIT) events.push('timeout');
    if (events.length) break;
  }
  return events;
}

// Desenlace, llamado al final. Si la ambulancia llegó mientras la persona sigue en paro, el desenlace se decide
// solo con el tiempo sin RCP (arrestNoCpr < 180) y el daño acumulado: es una abstracción del simulador para cerrar
// el caso, no una simulación de lo que hacen los paramédicos.
function outcome(s) {
  if (s.arrest) {
    if (s.called911 !== null && s.t >= s.called911 + EMS_DELAY && s.arrestNoCpr < 180 && s.damage < 300)
      return s.damage > 85 ? 'dano' : 'sobrevive';
    return 'muerte';
  }
  if (s.damage >= 300) return 'muerte';
  if (s.damage > 85) return 'dano';
  return 'sobrevive';
}

export { CASES, createSim, derived, advance, step, outcome, naloxBlock, lastEffectiveDose, EMS_DELAY, T_LIMIT, DOSES, VOMIT_DELAY };
