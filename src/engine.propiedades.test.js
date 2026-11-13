// Propiedades del motor. A diferencia de engine.test.js, no fijan números: revisan que la lógica tenga sentido
// para cualquier momento y combinación de acciones. Si una falla después de cambiar engine.js, el modelo dejó de
// premiar lo que enseña el protocolo DSPR: revisar el cambio con su fuente antes de tocar la prueba.
import { describe, it, expect } from 'vitest';
import * as E from './engine.js';

const FIN = ['ems', 'death', 'timeout'];
const RANK = { sobrevive: 0, dano: 1, muerte: 2 };
const MODO = { esperar: 'none', respiraciones: 'breaths', rcp: 'cpr' };

// Juega una lista de pasos ([acción, segundos]) y luego espera hasta el final. Como la interfaz, se detiene en la
// muerte, la llegada de la ambulancia o el límite de tiempo (el motor por sí solo seguiría avanzando).
function jugar(caseId, pasos) {
  const s = E.createSim(caseId);
  let fin = false;
  const avanzar = (n, modo) => {
    for (let quedan = n; quedan > 0 && !fin;) {
      const t0 = s.t, ev = E.advance(s, quedan, modo);
      quedan -= s.t - t0;
      if (ev.some((e) => FIN.includes(e))) fin = true;
    }
  };
  for (const [accion, n] of pasos) {
    if (fin) break;
    if (accion === 'llamar' && s.called911 === null) s.called911 = s.t;
    else if (accion === 'naloxona' && s.doses.length < E.DOSES) s.doses.push({ t: s.t, f: 1 });
    else if (accion === 'lado') s.position = 'lado';
    else if (MODO[accion]) avanzar(n, MODO[accion]);
  }
  avanzar(E.T_LIMIT, 'none');
  return { rank: RANK[E.outcome(s)], t: s.t, dmg: s.damage };
}

// a es peor que b: peor desenlace; si ambos mueren, a muere antes; si no, a tiene más daño.
const peor = (a, b) => (a.rank !== b.rank ? a.rank > b.rank : a.rank === RANK.muerte ? a.t < b.t : a.dmg > b.dmg + 1e-9);
const serie = (desde, hasta, paso) => Array.from({ length: Math.floor((hasta - desde) / paso) + 1 }, (_, i) => desde + i * paso);
// Valores de x donde el resultado mejora al crecer x (por ejemplo, esperar más antes de dar naloxona).
function mejoraAlCrecer(xs, f) {
  const malos = []; let prev = f(xs[0]);
  for (const x of xs.slice(1)) { const r = f(x); if (peor(prev, r)) malos.push(x); prev = r; }
  return malos;
}
// Valores de x donde el resultado empeora al crecer x (por ejemplo, más segundos de RCP).
function empeoraAlCrecer(xs, f) {
  const malos = []; let prev = f(xs[0]);
  for (const x of xs.slice(1)) { const r = f(x); if (peor(r, prev)) malos.push(x); prev = r; }
  return malos;
}

const CASOS_OPIOIDE = ['fentanilo', 'pastillas', 'xilazina'];

describe('Determinismo', () => {
  it('el mismo plan da siempre el mismo resultado', () => {
    for (const c of Object.keys(E.CASES)) {
      const plan = [['llamar'], ['respiraciones', 60], ['naloxona'], ['rcp', 30], ['lado'], ['esperar', 120]];
      expect(jugar(c, plan)).toEqual(jugar(c, plan));
    }
  });

  it('el resultado no depende del tamaño de los bloques en que se avanza (la interfaz avanza por bloques)', () => {
    for (const c of Object.keys(E.CASES)) for (const modo of ['none', 'breaths', 'cpr']) {
      const estados = [1, 7, 37, 120].map((bloque) => {
        const s = E.createSim(c); s.called911 = 0; s.doses.push({ t: 30, f: 1 });
        while (s.t < 600) {
          const ev = E.advance(s, Math.min(bloque, 600 - s.t), modo);
          if (ev.some((e) => FIN.includes(e))) break;
        }
        return [s.t, s.o2, s.damage, s.arrest, s.vomitAt, s.awakeAt];
      });
      for (const e of estados) expect(e).toEqual(estados[0]);
    }
  });
});

describe('Límites', () => {
  it('con 300 planes al azar, los signos quedan dentro de rango en cada segundo', () => {
    let semilla = 12345;
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
    const acciones = ['none', 'breaths', 'cpr', 'naloxona', 'lado', 'abrir', 'llamar'];
    let violaciones = 0;
    for (let p = 0; p < 300; p++) {
      const s = E.createSim(Object.keys(E.CASES)[p % 4]);
      for (let i = 0; i < 25 && s.t < E.T_LIMIT; i++) {
        const a = acciones[Math.floor(azar() * acciones.length)];
        if (a === 'naloxona' && s.doses.length < E.DOSES) s.doses.push({ t: s.t, f: [1, 0.6, 0][Math.floor(azar() * 3)] });
        if (a === 'lado') s.position = 'lado';
        if (a === 'abrir') { s.position = 'espalda'; s.airwayOpen = true; }
        if (a === 'llamar' && s.called911 === null) s.called911 = s.t;
        const n = 1 + Math.floor(azar() * 90);
        for (let k = 0; k < n; k++) {
          E.step(s, ['none', 'breaths', 'cpr'].includes(a) ? a : 'none');
          const d = E.derived(s);
          const dentro = s.o2 >= 0 && s.o2 <= 99 && d.rr >= 0 && [0, 1, 2, 3].includes(d.cons)
            && d.pupil >= 1.1 - 1e-9 && d.pupil <= 4.0 + 1e-9 && d.block <= 0.96 + 1e-12
            && s.opioid <= s.cap + 1e-12 && Number.isFinite(s.damage) && s.damage >= 0;
          const paroCoherente = !s.arrest || (d.rr === 0 && d.cons === 0);
          if (!dentro || !paroCoherente) violaciones++;
        }
      }
    }
    expect(violaciones).toBe(0);
  });
});

describe('Protocolo: actuar antes o más tiempo nunca empeora el desenlace', () => {
  it('naloxona antes (con 9-1-1 al inicio)', () => {
    for (const c of CASOS_OPIOIDE)
      expect(mejoraAlCrecer(serie(0, 600, 10), (td) => jugar(c, [['llamar'], ['esperar', td], ['naloxona']])), c).toEqual([]);
  });

  it('9-1-1 antes', () => {
    for (const c of Object.keys(E.CASES))
      expect(mejoraAlCrecer(serie(0, 600, 10), (tc) => jugar(c, [['esperar', tc], ['llamar']])), c).toEqual([]);
  });

  it('respiraciones de rescate más largas (sin naloxona, con 9-1-1)', () => {
    for (const c of CASOS_OPIOIDE)
      expect(empeoraAlCrecer(serie(0, 480, 10), (d) => jugar(c, [['llamar'], ['respiraciones', d]])), c).toEqual([]);
  });

  it('más RCP en un paro (hallazgo tardío, con 9-1-1 y naloxona)', () => {
    expect(empeoraAlCrecer(serie(0, 480, 10), (d) => jugar('tardio', [['llamar'], ['naloxona'], ['rcp', d]]))).toEqual([]);
  });

  it('una segunda dosis de naloxona no empeora', () => {
    for (const c of CASOS_OPIOIDE) for (const t2 of [60, 180, 300]) {
      const una = jugar(c, [['llamar'], ['naloxona'], ['esperar', t2]]);
      const dos = jugar(c, [['llamar'], ['naloxona'], ['esperar', t2], ['naloxona']]);
      expect(peor(dos, una), `${c} segunda dosis a los ${t2} s`).toBe(false);
    }
  });

  it('la posición de rescate no empeora', () => {
    for (const c of CASOS_OPIOIDE) {
      const boca = jugar(c, [['llamar'], ['naloxona'], ['esperar', 60]]);
      const lado = jugar(c, [['llamar'], ['naloxona'], ['esperar', 60], ['lado']]);
      expect(peor(lado, boca), c).toBe(false);
    }
  });
});
