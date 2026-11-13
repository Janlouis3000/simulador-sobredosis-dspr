// Calibración del motor. Los valores esperados son la salida de `node src/test.js` de la v2;
// si cambian, el modelo clínico cambió y necesita fuente y revisión (ver CLAUDE.md).
import { describe, expect, test } from 'vitest';
import { SCENARIOS, run, line } from './escenarios.js';
import { createSim, derived, naloxBlock } from './engine.js';

const EXPECTED = [
  'fentanilo => sobrevive t 500 dmg 8 o2 98 events vomit,awake,ems',
  'fentanilo => muerte t 354 dmg 300 o2 12 events ',
  'fentanilo => sobrevive t 500 dmg 3 o2 89 events ems',
  'fentanilo => sobrevive t 490 dmg 40 o2 98 events vomit,awake',
  'fentanilo => sobrevive t 1200 dmg 2 o2 98 events vomit,awake',
  'fentanilo => dano t 655 dmg 99 o2 98 events vomit,awake',
  'pastillas => sobrevive t 500 dmg 4 o2 98 events vomit,awake,ems',
  'pastillas => muerte t 419 dmg 300 o2 13 events ',
  'pastillas => sobrevive t 500 dmg 1 o2 89 events ems',
  'pastillas => sobrevive t 490 dmg 25 o2 98 events vomit,awake',
  'pastillas => sobrevive t 1200 dmg 0 o2 98 events vomit,awake',
  'pastillas => sobrevive t 655 dmg 74 o2 98 events vomit,awake',
  'xilazina => sobrevive t 500 dmg 11 o2 98 events vomit,ems',
  'xilazina => muerte t 329 dmg 301 o2 11 events ',
  'xilazina => sobrevive t 500 dmg 6 o2 89 events ems',
  'xilazina => sobrevive t 490 dmg 73 o2 77 events vomit,ems',
  'xilazina => sobrevive t 1200 dmg 4 o2 98 events vomit',
  'xilazina => muerte t 329 dmg 301 o2 11 events arrest,death',
  'tardio => dano t 620 dmg 107 o2 98 events rosc,awake,ems',
  'tardio => muerte t 176 dmg 302 o2 8 events death',
  'tardio => dano t 500 dmg 114 o2 86 events rosc,ems',
  'tardio => muerte t 176 dmg 302 o2 8 events ',
  'tardio => sobrevive t 600 dmg 77 o2 98 events rosc,awake',
  'tardio => dano t 610 dmg 92 o2 86 events rosc',
];

describe('calibración (igual que la v2)', () => {
  SCENARIOS.forEach((sc, i) => {
    test(sc.name, () => { expect(line(run(sc.caseId, sc.plan))).toBe(EXPECTED[i]); });
  });
});

describe('reglas de CLAUDE.md', () => {
  const outcomeOf = (name) => { const sc = SCENARIOS.find((s) => s.name === name); return run(sc.caseId, sc.plan).outcome; };
  test.each(['fentanilo', 'pastillas', 'xilazina'])('%s: buena respuesta = sobrevive', (c) => {
    expect(outcomeOf(`${c}: buena respuesta`)).toBe('sobrevive');
  });
  test.each(['fentanilo', 'pastillas', 'xilazina', 'tardio'])('%s: no hacer nada = muerte', (c) => {
    expect(outcomeOf(`${c}: no hacer nada`)).toBe('muerte');
  });
  test('tardío sin RCP = muerte', () => { expect(outcomeOf('tardio: solo respiraciones')).toBe('muerte'); });
});

describe('naloxona', () => {
  test('empieza a los 30 s y llega a su efecto completo a los 2 min', () => {
    const s = createSim('fentanilo');
    s.doses.push({ t: 0, f: 1 });
    expect(naloxBlock(s, 30)).toBe(0);
    expect(naloxBlock(s, 120)).toBeCloseTo(0.62);
    expect(naloxBlock(s, 600)).toBeCloseTo(0.62);
  });
  test('dos dosis no pasan del 96 % de bloqueo', () => {
    const s = createSim('fentanilo');
    s.doses.push({ t: 0, f: 1 }, { t: 0, f: 1 });
    expect(naloxBlock(s, 600)).toBe(0.96);
  });
  test('no revierte la xilazina: la persona sigue sin despertar', () => {
    const s = createSim('xilazina');
    s.doses.push({ t: -600, f: 1 }, { t: -600, f: 1 });
    expect(derived(s).cons).toBeLessThan(3);
  });
});
