// Pruebas del motor.
//
// Calibración: son pruebas de regresión contra la v2. Los valores esperados son la salida de `node src/test.js` de la
// v2 y solo comprueban que el motor siga dando los mismos resultados; no son evidencia de validez clínica. Si cambian,
// el modelo cambió y necesita fuente y revisión (ver CLAUDE.md).
import { describe, expect, test } from 'vitest';
import { SCENARIOS, run, line } from './escenarios.js';
import { EMS_DELAY, VOMIT_DELAY, advance, createSim, derived, naloxBlock, outcome } from './engine.js';

// Una expectativa por escenario, vinculada a su nombre (no a su posición en SCENARIOS).
const EXPECTED = [
  ['fentanilo: buena respuesta', 'fentanilo => sobrevive t 500 dmg 8 o2 98 events vomit,awake,ems'],
  ['fentanilo: no hacer nada', 'fentanilo => muerte t 354 dmg 300 o2 12 events '],
  ['fentanilo: sin naloxona', 'fentanilo => sobrevive t 500 dmg 3 o2 89 events ems'],
  ['fentanilo: solo naloxona', 'fentanilo => sobrevive t 490 dmg 40 o2 98 events vomit,awake'],
  ['fentanilo: sin llamar', 'fentanilo => sobrevive t 1200 dmg 2 o2 98 events vomit,awake'],
  ['fentanilo: 9-1-1 tarde', 'fentanilo => dano t 655 dmg 99 o2 98 events vomit,awake'],
  ['pastillas: buena respuesta', 'pastillas => sobrevive t 500 dmg 4 o2 98 events vomit,awake,ems'],
  ['pastillas: no hacer nada', 'pastillas => muerte t 419 dmg 300 o2 13 events '],
  ['pastillas: sin naloxona', 'pastillas => sobrevive t 500 dmg 1 o2 89 events ems'],
  ['pastillas: solo naloxona', 'pastillas => sobrevive t 490 dmg 25 o2 98 events vomit,awake'],
  ['pastillas: sin llamar', 'pastillas => sobrevive t 1200 dmg 0 o2 98 events vomit,awake'],
  ['pastillas: 9-1-1 tarde', 'pastillas => sobrevive t 655 dmg 74 o2 98 events vomit,awake'],
  ['xilazina: buena respuesta', 'xilazina => sobrevive t 500 dmg 11 o2 98 events vomit,ems'],
  ['xilazina: no hacer nada', 'xilazina => muerte t 329 dmg 301 o2 11 events '],
  ['xilazina: sin naloxona', 'xilazina => sobrevive t 500 dmg 6 o2 89 events ems'],
  ['xilazina: solo naloxona', 'xilazina => sobrevive t 490 dmg 73 o2 77 events vomit,ems'],
  ['xilazina: sin llamar', 'xilazina => sobrevive t 1200 dmg 4 o2 98 events vomit'],
  ['xilazina: 9-1-1 tarde', 'xilazina => muerte t 329 dmg 301 o2 11 events arrest,death'],
  ['tardio: RCP inmediata', 'tardio => dano t 620 dmg 107 o2 98 events rosc,awake,ems'],
  ['tardio: solo respiraciones', 'tardio => muerte t 176 dmg 302 o2 8 events death'],
  ['tardio: RCP tras llamar', 'tardio => dano t 500 dmg 114 o2 86 events rosc,ems'],
  ['tardio: no hacer nada', 'tardio => muerte t 176 dmg 302 o2 8 events '],
  ['tardio: RCP primero', 'tardio => sobrevive t 600 dmg 77 o2 98 events rosc,awake'],
  ['tardio: RCP corta', 'tardio => dano t 610 dmg 92 o2 86 events rosc'],
];

const repetidos = (nombres) => [...new Set(nombres.filter((n, i) => nombres.indexOf(n) !== i))];
const ESPERADO = new Map(EXPECTED);

describe('calibración (regresión contra la v2)', () => {
  test('cada escenario tiene exactamente una expectativa, y cada expectativa un escenario', () => {
    const escenarios = SCENARIOS.map((s) => s.name), esperados = EXPECTED.map(([n]) => n);
    expect(repetidos(escenarios), 'nombres de escenario repetidos en escenarios.js').toEqual([]);
    expect(repetidos(esperados), 'expectativas repetidas en engine.test.js').toEqual([]);
    expect(escenarios.filter((n) => !ESPERADO.has(n)), 'escenarios sin expectativa en engine.test.js').toEqual([]);
    expect(esperados.filter((n) => !escenarios.includes(n)), 'expectativas de escenarios que ya no existen').toEqual([]);
  });

  for (const sc of SCENARIOS) {
    test(sc.name, () => {
      if (!ESPERADO.has(sc.name)) throw new Error(`Falta la expectativa de calibración de "${sc.name}" en engine.test.js`);
      expect(line(run(sc.caseId, sc.plan))).toBe(ESPERADO.get(sc.name));
    });
  }
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

describe('eventos del mismo segundo en advance()', () => {
  // Naloxona al inicio y a los 3 minutos, con respiraciones de rescate: la persona vomita y después despierta. La hora
  // de la llamada al 9-1-1 no cambia la fisiología, así que se escoge para que la ambulancia llegue en un segundo dado.
  const preparar = (llamada = null) => {
    const s = createSim('fentanilo'); s.doses.push({ t: 0, f: 1 }, { t: 180, f: 1 }); s.called911 = llamada; return s;
  };
  const segundoDe = (evento) => {
    const s = preparar();
    for (let i = 0; i < 1200; i++) if (advance(s, 1, 'breaths').includes(evento)) return s.t;
    throw new Error(`No ocurrió ${evento}`);
  };

  test('si la ambulancia llega en el mismo segundo en que vomita, avisa los dos eventos en esa llamada', () => {
    const tv = segundoDe('vomit');
    const s = preparar(tv - EMS_DELAY);
    expect(advance(s, 1200, 'breaths')).toEqual(['vomit', 'ems']);
    expect(s.t).toBe(tv);
    expect(s.vomitAt).toBe(tv);
  });

  test('si la ambulancia llega en el mismo segundo en que despierta, avisa los dos eventos en esa llamada', () => {
    const tv = segundoDe('vomit'), ta = segundoDe('awake');
    expect(ta).toBeGreaterThan(tv);
    const s = preparar(ta - EMS_DELAY);
    expect(advance(s, 1200, 'breaths')).toEqual(['vomit']); // antes: el vómito, sin ambulancia todavía
    expect(advance(s, 1200, 'breaths')).toEqual(['awake', 'ems']);
    expect(s.t).toBe(ta);
    expect(s.awakeAt).toBe(ta);
  });

  test('sin coincidencia, cada evento sale solo (como en la v2)', () => {
    const tv = segundoDe('vomit');
    const s = preparar(tv + 1 - EMS_DELAY);
    expect(advance(s, 1200, 'breaths')).toEqual(['vomit']);
    expect(s.t).toBe(tv);
    expect(advance(s, 1200, 'breaths')).toEqual(['ems']);
    expect(s.t).toBe(tv + 1);
  });

  test('entre los eventos que terminan se conserva la prioridad: la ambulancia antes que la muerte', () => {
    // Hallazgo tardío sin RCP: el daño llega a 300 en un segundo fijo. Si la ambulancia llega en ese mismo segundo,
    // solo se informa 'ems', pero el desenlace sigue siendo la muerte (outcome() mira el daño).
    const sinAyuda = createSim('tardio');
    let ev = [];
    while (!ev.length) ev = advance(sinAyuda, 1200, 'none');
    expect(ev).toEqual(['death']);
    const s = createSim('tardio');
    s.called911 = sinAyuda.t - EMS_DELAY;
    expect(advance(s, 1200, 'none')).toEqual(['ems']);
    expect(s.t).toBe(sinAyuda.t);
    expect(outcome(s)).toBe('muerte');
  });
});

describe('desenlace si la ambulancia llega con la persona todavía en paro', () => {
  // Regla de outcome(): con la ambulancia ya llegada, menos de 180 s de paro sin RCP y daño menor de 300, el caso se
  // cierra como 'sobrevive' (daño hasta 85) o 'dano'. Es una abstracción del simulador para cerrar el caso: no
  // simula lo que hacen los paramédicos. Estas pruebas fijan esa regla tal como está; no cambian sus umbrales.
  const enParo = (cambios = {}) => Object.assign(createSim('tardio'), { t: 600, called911: 100, arrestNoCpr: 100, damage: 50 }, cambios);

  test('ambulancia llegada, poco tiempo sin RCP y poco daño: sobrevive', () => {
    expect(enParo().arrest).toBe(true);
    expect(outcome(enParo())).toBe('sobrevive');
    expect(outcome(enParo({ damage: 85, arrestNoCpr: 179 }))).toBe('sobrevive');
  });
  test('con más de 85 de daño: posible daño cerebral', () => {
    expect(outcome(enParo({ damage: 86 }))).toBe('dano');
    expect(outcome(enParo({ damage: 299 }))).toBe('dano');
  });
  test('180 s o más sin RCP, 300 de daño o más, o la ambulancia todavía no llega: muerte', () => {
    expect(outcome(enParo({ arrestNoCpr: 180 }))).toBe('muerte');
    expect(outcome(enParo({ damage: 300 }))).toBe('muerte');
    expect(outcome(enParo({ t: 100 + EMS_DELAY - 1 }))).toBe('muerte');
    expect(outcome(enParo({ called911: null }))).toBe('muerte');
  });
});

describe('vómito: aparece unos segundos después de la dosis', () => {
  // Naloxona al inicio y respiraciones: la persona empieza a responder y vomita en un segundo T fijo.
  const preparar = (dosis, extra = {}) => Object.assign(createSim('fentanilo'), { doses: dosis.map((d) => ({ ...d })) }, extra);
  const hastaVomito = (s, accion = 'breaths') => {
    for (let i = 0; i < 1200; i++) { const ev = advance(s, 1, accion); if (ev.includes('vomit')) return s.t; }
    return null;
  };
  const T = hastaVomito(preparar([{ t: 0, f: 1 }]));

  test('con la dosis lejos, el episodio sale en el segundo en que la persona empieza a responder (como en la v2)', () => {
    expect(T).toBeGreaterThan(30 + VOMIT_DELAY);
  });

  test(`si otra dosis acaba de entrar, el aviso espera ${VOMIT_DELAY} s simulados desde esa dosis, aunque la acción avance de golpe`, () => {
    const s = preparar([{ t: 0, f: 1 }, { t: T - 2, f: 1 }]);
    const ev = advance(s, 600, 'breaths'); // una sola acción larga
    expect(ev).toEqual(['vomit']);
    expect(s.vomitAt).toBe(T - 2 + VOMIT_DELAY);
    expect(s.t).toBe(T - 2 + VOMIT_DELAY); // el reloj se detiene ahí, no al final de la acción
  });

  test('el retraso es configurable por simulación', () => {
    const s = preparar([{ t: 0, f: 1 }, { t: T - 2, f: 1 }], { vomitDelay: 12 });
    expect(hastaVomito(s)).toBe(T - 2 + 12);
  });

  test('una dosis desperdiciada (f: 0) no cuenta como la última dosis ni desencadena el episodio por sí sola', () => {
    // Desperdiciada justo antes: no aplaza el aviso (la última dosis que entró es la del inicio).
    expect(hastaVomito(preparar([{ t: 0, f: 1 }, { t: T - 2, f: 0 }]))).toBe(T);
    // Solo dosis desperdiciadas: aunque la persona empiece a responder (aquí, al subir el oxígeno), no vomita.
    const base = { opioid: 0.5, o2: 59.6 };
    const sin = preparar([{ t: 0, f: 0 }], base);
    const ev = advance(sin, 120, 'breaths');
    expect(derived(sin).cons).toBeGreaterThanOrEqual(1);
    expect(ev).not.toContain('vomit');
    expect(sin.vomitAt).toBeNull();
    // Con una dosis que entró, el mismo cambio sí lo desencadena.
    expect(hastaVomito(preparar([{ t: -100, f: 1 }], base))).not.toBeNull();
  });

  test('ocurre una sola vez y una simulación nueva empieza sin episodio', () => {
    const s = preparar([{ t: 0, f: 1 }]);
    const eventos = [];
    while (s.t < 1000) eventos.push(...advance(s, 50, 'breaths'));
    expect(eventos.filter((e) => e === 'vomit')).toHaveLength(1);
    const otra = createSim('fentanilo');
    expect([otra.vomitAt, otra.vomitPending, otra.vomitHandled]).toEqual([null, null, false]);
  });

  test('boca arriba queda sin proteger; de lado, el vómito sale de la boca (vomitHandled)', () => {
    const boca = preparar([{ t: 0, f: 1 }]);
    const lado = preparar([{ t: 0, f: 1 }], { position: 'lado' });
    expect(hastaVomito(boca)).not.toBeNull();
    expect(hastaVomito(lado)).not.toBeNull();
    expect(boca.vomitHandled).toBe(false);
    expect(lado.vomitHandled).toBe(true);
  });
});