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

function createSim(caseId) {
  const c = CASES[caseId];
  return {
    caseId, t: 0, o2: c.o2, opioid: c.opioid, rise: c.rise, cap: c.cap, xyl: c.xyl,
    damage: c.damage, lowO2: 0,
    doses: [], position: 'espalda', airwayOpen: false, hist: [[0, c.o2, 0, !!c.arrest]],
    called911: null, checkedResp: null, checkedBreath: null, firstVent: null,
    arrest: !!c.arrest, arrestAt: c.arrest ? 0 : null, arrestNoCpr: 0, cprInArrest: 0, rosc: null,
    vomitAt: null, vomitHandled: false, aspirated: false,
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

// Avanza n segundos con una acción; se detiene si ocurre un evento.
function advance(s, n, action) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const before = derived(s);
    const wasArrest = s.arrest;
    step(s, action);
    const after = derived(s);
    if (!wasArrest && s.arrest) { events.push('arrest'); break; }
    if (wasArrest && !s.arrest) { events.push('rosc'); break; }
    if (s.vomitAt === null && s.doses.length && before.cons === 0 && after.cons >= 1) {
      s.vomitAt = s.t;
      if (s.position === 'lado') s.vomitHandled = true;
      events.push('vomit'); break;
    }
    if (s.awakeAt === null && after.cons === 3) { s.awakeAt = s.t; events.push('awake'); break; }
    if (s.called911 !== null && s.t >= s.called911 + EMS_DELAY) { events.push('ems'); break; }
    if (s.arrest && s.arrestNoCpr >= 240) { events.push('death'); break; }
    if (s.damage >= 300) { events.push('death'); break; }
    if (s.t >= T_LIMIT) { events.push('timeout'); break; }
  }
  return events;
}

function outcome(s) {
  // Llamado al final
  if (s.arrest) {
    if (s.called911 !== null && s.t >= s.called911 + EMS_DELAY && s.arrestNoCpr < 180 && s.damage < 300)
      return s.damage > 85 ? 'dano' : 'sobrevive';
    return 'muerte';
  }
  if (s.damage >= 300) return 'muerte';
  if (s.damage > 85) return 'dano';
  return 'sobrevive';
}

export { CASES, createSim, derived, advance, step, outcome, naloxBlock, EMS_DELAY, T_LIMIT, DOSES };
