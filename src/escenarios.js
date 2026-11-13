// Escenarios de calibración del motor. Los usan engine.test.js (Vitest) y scripts/calibrar.js.
import * as E from './engine.js';

export const COST = { resp: 10, breath: 10, call: 20, nalox: 15, breaths: 60, cpr: 120, observe: 60, lado: 15, water: 45, sleep: 120 };

// Corre un plan de acciones y devuelve el desenlace. `log` recibe una línea por acción (modo detallado).
export function run(caseId, plan, log) {
  const s = E.createSim(caseId); const evs = [];
  for (const a of plan) {
    if (s.ended) break;
    let mode = 'none';
    if (a === 'call') s.called911 = s.t;
    if (a === 'nalox' && s.doses.length < 2) s.doses.push(s.t);
    if (a === 'lado') s.position = 'lado';
    if (a === 'breaths') mode = 'breaths';
    if (a === 'cpr') mode = 'cpr';
    const ev = E.advance(s, COST[a], mode);
    const d = E.derived(s);
    if (log) log([a.padEnd(8), 't', s.t, 'o2', s.o2.toFixed(0), 'rr', d.rr.toFixed(1), 'cons', d.cons, 'dmg', s.damage.toFixed(0), s.arrest ? 'PARO' : '', ev.join(',')].join(' '));
    if (ev.some((e) => ['ems', 'death', 'timeout'].includes(e))) s.ended = true;
    evs.push(...ev);
  }
  // Si no terminó, sigue observando hasta el final
  let guard = 0;
  while (!s.ended && guard++ < 40) { const ev = E.advance(s, 60, 'none'); if (ev.some((e) => ['ems', 'death', 'timeout'].includes(e))) s.ended = true; }
  return { caseId, outcome: E.outcome(s), t: s.t, damage: Number(s.damage.toFixed(0)), o2: Number(s.o2.toFixed(0)), events: evs.join(',') };
}

export function line(r) {
  return [r.caseId, '=>', r.outcome, 't', r.t, 'dmg', r.damage, 'o2', r.o2, 'events', r.events].join(' ');
}

const good = ['resp', 'breath', 'call', 'nalox', 'breaths', 'breaths', 'nalox', 'breaths', 'lado', 'observe', 'observe', 'observe', 'observe', 'observe', 'observe'];
const nothing = [];
const noNalox = ['resp', 'breath', 'call', 'breaths', 'breaths', 'breaths', 'breaths', 'breaths', 'breaths', 'breaths', 'breaths'];
const naloxOnly = ['resp', 'call', 'nalox', 'observe', 'observe', 'nalox', 'observe', 'observe', 'observe', 'observe', 'observe', 'observe'];
const noCall = ['resp', 'breath', 'nalox', 'breaths', 'breaths', 'nalox', 'breaths', 'lado', 'observe'];
const late911 = ['resp', 'water', 'sleep', 'call', 'nalox', 'breaths', 'breaths', 'nalox', 'breaths', 'lado', 'observe', 'observe', 'observe', 'observe'];

// Mismo orden que el test.js original de la v2.
export const SCENARIOS = [];
for (const c of ['fentanilo', 'pastillas', 'xilazina']) {
  SCENARIOS.push(
    { name: `${c}: buena respuesta`, caseId: c, plan: good },
    { name: `${c}: no hacer nada`, caseId: c, plan: nothing },
    { name: `${c}: sin naloxona`, caseId: c, plan: noNalox },
    { name: `${c}: solo naloxona`, caseId: c, plan: naloxOnly },
    { name: `${c}: sin llamar`, caseId: c, plan: noCall },
    { name: `${c}: 9-1-1 tarde`, caseId: c, plan: late911 },
  );
}
SCENARIOS.push(
  { name: 'tardio: RCP inmediata', caseId: 'tardio', plan: ['resp', 'breath', 'cpr', 'call', 'nalox', 'cpr', 'cpr', 'nalox', 'cpr', 'cpr', 'observe', 'observe', 'observe'], verbose: true },
  { name: 'tardio: solo respiraciones', caseId: 'tardio', plan: ['resp', 'breath', 'call', 'nalox', 'breaths', 'breaths', 'nalox', 'breaths', 'observe', 'observe'], verbose: true },
  { name: 'tardio: RCP tras llamar', caseId: 'tardio', plan: ['resp', 'breath', 'call', 'cpr', 'nalox', 'cpr', 'cpr', 'cpr', 'observe'], verbose: true },
  { name: 'tardio: no hacer nada', caseId: 'tardio', plan: nothing },
  { name: 'tardio: RCP primero', caseId: 'tardio', plan: ['cpr', 'call', 'nalox', 'cpr', 'cpr', 'nalox', 'cpr', 'observe'] },
  { name: 'tardio: RCP corta', caseId: 'tardio', plan: ['resp', 'cpr', 'call', 'nalox', 'cpr', 'cpr', 'observe'] },
);
