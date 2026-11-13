import { describe, expect, it } from 'vitest';
import { ARBOL } from './arbol/arbol';
import { CASOS_ARBOL, FENTANILO, PASTILLAS, TARDIO, XILAZINA } from './casos/casos';
import { CLINICA } from './config/clinica';
import {
  avanzarInformacion, crearPartida, elegir, llamarEnDialogo, nodo, opcionesDisponibles, practicarNaloxona, responderDialogo, seguirDialogo,
} from './interprete';
import { faltaParaDosis } from './observaciones';
import { alAzar, ctxDe, jugar, mejor, semilla } from './prueba-util';
import { calcularResultado } from './retro';
import { PERFILES } from './tipos';
import type { Partida } from './tipos';

const ctx = ctxDe(FENTANILO);
const ctxT = ctxDe(TARDIO);
const ids = (p: Partida) => opcionesDisponibles(ctx, p).map((o) => o.id);
/** Avanza con la mejor política hasta llegar al nodo pedido. */
const hasta = (nodoId: string, perfil: Partida['perfil'] = 'cpr_trained', c = ctx) => jugar(c, perfil, mejor, (p) => p.nodo === nodoId).p;

describe('transiciones del árbol (caso 1, fentanilo)', () => {
  it('empieza en el aviso y sigue: encontrar, seguridad, responde', () => {
    let p = crearPartida(ctx, 'cpr_trained');
    expect(p.nodo).toBe('aviso');
    p = avanzarInformacion(ctx, p); expect(p.nodo).toBe('encontrar');
    p = avanzarInformacion(ctx, p); expect(p.nodo).toBe('seguridad');
    p = elegir(ctx, p, 'mirar'); expect(p.nodo).toBe('responde');
  });

  it('comprobar respuesta pasa por la evaluación y lleva a la respiración', () => {
    const p = elegir(ctx, hasta('responde'), 'llamar_frotar');
    expect(p.nodo).toBe('respiracion');
    expect(p.observaciones.map((o) => o.clave)).toContain('obs.respuesta.nada');
    expect(p.acciones).toContain('comprobar_respuesta');
  });

  it('respiración anormal lleva a llamar al 9-1-1', () => {
    const p = elegir(ctx, hasta('respiracion'), 'mirar_pecho');
    expect(p.nodo).toBe('llamar');
    expect(p.flags).toContain('hubo_respiracion_anormal');
    expect(p.observaciones.map((o) => o.clave)).toContain('obs.respiracion.muy_lenta');
  });

  it('una decisión incorrecta no bloquea: se explica, pasa el tiempo y se puede escoger otra vez', () => {
    const antes = hasta('responde');
    const p = elegir(ctx, antes, 'agua');
    expect(p.nodo).toBe('responde');
    expect(p.sim.t - antes.sim.t).toBe(CLINICA.tiempos.aguaFria);
    expect(p.sim.myths).toBe(1);
    expect(p.registro.at(-1)).toMatchObject({ calidad: 'incorrecta', feedbackKey: 'fb.responde.agua' });
    expect(antes.sim.myths).toBe(0); // la partida anterior no cambia
  });

  it('llamar al 9-1-1 registra la hora y lleva al operador', () => {
    const antes = hasta('llamar');
    const p = elegir(ctx, antes, 'altavoz');
    expect(p.sim.called911).toBe(antes.sim.t);
    expect(p.nodo).toBe('operador');
  });

  it('una opción que no está disponible da error', () => {
    expect(() => elegir(ctx, hasta('llamar'), 'segunda_dosis')).toThrow();
  });
});

describe('perfiles de capacitación', () => {
  it('el operador dice algo distinto en cada perfil', () => {
    const n = nodo(ctx, 'operador');
    const textos = PERFILES.map((p) => n.promptKeyPorPerfil?.[p]);
    expect(new Set(textos).size).toBe(3);
  });

  it('ventilar: respiraciones de rescate solo con capacitación; los otros siguen al operador', () => {
    expect(ids(hasta('ventilar', 'cpr_trained'))).toEqual(expect.arrayContaining(['respiraciones']));
    expect(ids(hasta('ventilar', 'cpr_trained'))).not.toContain('operador');
    for (const perfil of ['basic_responder', 'unsure'] as const) {
      expect(ids(hasta('ventilar', perfil))).toContain('operador');
      expect(ids(hasta('ventilar', perfil))).not.toContain('respiraciones');
    }
  });

  it('RCP 30:2 con capacitación; compresiones guiadas por el operador sin ella (caso de paro)', () => {
    const op = (perfil: Partida['perfil']) => opcionesDisponibles(ctxT, hasta('rcp', perfil, ctxT)).map((o) => o.id);
    expect(op('cpr_trained')).toContain('rcp_30_2');
    expect(op('cpr_trained')).not.toContain('compresiones_guiadas');
    expect(op('basic_responder')).toContain('compresiones_guiadas');
    expect(op('unsure')).toContain('compresiones_guiadas');
  });

  it.each(PERFILES)('el perfil %s llega al resultado y todos llaman al 9-1-1 y dan naloxona', (perfil) => {
    const { p } = jugar(ctx, perfil, mejor);
    expect(p.terminada).toBe(true);
    expect(p.sim.called911).not.toBeNull();
    expect(p.acciones).toContain('naloxona');
    const r = calcularResultado(FENTANILO, p);
    expect(r.desenlace).toBe('sobrevive');
    expect(r.practicadas.map((x) => x.textKey)).toContain(`retro.perfil.${perfil}`);
  });
});

describe('naloxona', () => {
  it('técnica correcta: una dosis completa y sigue a la vía aérea', () => {
    const p = practicarNaloxona(ctx, hasta('naloxona'), [0, 0, 0]);
    expect(p.sim.doses).toHaveLength(1);
    expect(p.sim.doses[0]?.f).toBe(1);
    expect(p.acciones).toContain('naloxona');
    expect(p.nodo).toBe('via_aerea');
  });

  it('dividir la dosis entre las dos fosas nasales da solo parte de la dosis', () => {
    const p = practicarNaloxona(ctx, hasta('naloxona'), [0, 0, 1]);
    expect(p.sim.doses[0]?.f).toBe(0.6);
  });

  it('probarla al aire pierde el dispositivo; se intenta de nuevo con uno nuevo', () => {
    const p1 = practicarNaloxona(ctx, hasta('naloxona'), [0, 1]);
    expect(p1.sim.doses).toEqual([{ t: p1.sim.t, f: 0 }]);
    expect(p1.flags).toContain('dosis_perdida');
    expect(p1.nodo).toBe('naloxona');
    const p2 = practicarNaloxona(ctx, p1, [0, 0, 0]);
    expect(p2.sim.doses.map((d) => d.f)).toEqual([0, 1]);
    expect(p2.nodo).not.toBe('naloxona');
    expect(calcularResultado(FENTANILO, jugar(ctx, 'cpr_trained', mejor, undefined, p2).p).reforzar.map((x) => x.textKey)).toContain('retro.reforzar.no_probar');
  });

  it('si se pierden los dos dispositivos, sigue sin naloxona', () => {
    const p1 = practicarNaloxona(ctx, hasta('naloxona'), [0, 1]);
    const p2 = practicarNaloxona(ctx, p1, [0, 1]);
    expect(p2.sim.doses.map((d) => d.f)).toEqual([0, 0]);
    expect(p2.nodo).not.toBe('naloxona');
    expect(() => practicarNaloxona(ctx, { ...p2, nodo: 'naloxona' }, [0, 0, 0])).toThrow();
  });

  it(`segunda dosis: solo con un dispositivo nuevo y después de ${CLINICA.intervaloSegundaDosisS} s`, () => {
    // Con una dosis respira por su cuenta pero no despierta: se pone de lado y se vigila.
    let p = hasta('vigilar');
    expect(faltaParaDosis(p.sim)).toBeGreaterThan(0);
    expect(ids(p)).not.toContain('segunda_dosis');
    while (faltaParaDosis(p.sim) > 0 && p.nodo === 'vigilar') p = elegir(ctx, p, 'quedarse');
    expect(p.nodo).toBe('vigilar');
    expect(ids(p)).toContain('segunda_dosis');
    const q = elegir(ctx, p, 'segunda_dosis');
    expect(q.sim.doses).toHaveLength(2);
    expect(q.flags).toContain('dispositivo_nuevo');
    expect(q.acciones).toContain('segunda_dosis');
  });
});

describe('paro: RCP y vuelta a la respiración', () => {
  it('cuando vuelve el pulso deja las compresiones y no vuelve a ofrecer RCP mientras respira', () => {
    const { p } = jugar(ctxT, 'cpr_trained', mejor);
    expect(p.registro.some((r) => r.opcion === 'rcp_30_2')).toBe(true);
    expect(p.sim.rosc).not.toBeNull();
    const rosc = p.sim.rosc as number;
    expect(p.registro.filter((r) => r.t > rosc && r.nodo === 'rcp')).toEqual([]);
    expect(p.flags.includes('llego_lateral') || p.sim.awakeAt !== null).toBe(true);
  });

  it('ponerla de lado en paro es incorrecto y vuelve a la evaluación', () => {
    const p = elegir(ctxT, hasta('rcp', 'cpr_trained', ctxT), 'de_lado');
    expect(p.registro.at(-1)?.calidad).toBe('incorrecta');
    expect(p.nodo).toBe('rcp');
  });

  it.todo('despierta y vuelve a respirar mal (el motor no hace que la naloxona se pase): requiere revisión clínica y un cambio del modelo');
});

describe('conversación al despertar', () => {
  const ctxE = (emocion: string, c = FENTANILO) => ctxDe(c, { emocionFija: emocion, azar: () => 0 });
  const despierta = (c: ReturnType<typeof ctxE>) => jugar(c, 'cpr_trained', mejor, (p) => p.nodo === 'despierta').p;
  /** Responde cada turno con la respuesta que tenga ese "ok" (o la primera disponible). */
  function conversar(c: ReturnType<typeof ctxE>, p0: Partida, tipo: ('ok' | 'mid' | 'no')[]) {
    let p = p0;
    for (const t of tipo) {
      const d = p.dialogo;
      if (!d || d.fin) break;
      const turno = c.dialogos[c.caso.dialogo]?.turnos[d.turno];
      const k = d.orden.find((i) => turno?.o[i]?.ok === t && !turno.o[i]?.accion) ?? d.orden[0];
      p = responderDialogo(c, p, k as number);
      if (!p.dialogo?.fin) p = seguirDialogo(c, p);
    }
    return p;
  }

  it('llega a la conversación cuando despierta', () => {
    const p = despierta(ctxE('enojo'));
    expect(p.nodo).toBe('despierta');
    expect(p.dialogo?.agitacion).toBe(70);
  });

  it('con respuestas buenas se calma y se queda (agitación baja)', () => {
    const c = ctxE('enojo');
    const p = conversar(c, despierta(c), ['ok', 'ok', 'ok']);
    expect(p.dialogo?.fin).toBe('calma');
    expect(p.dialogo?.agitacion).toBeLessThanOrEqual(CLINICA.dialogo.calma);
    expect(seguirDialogo(c, p).nodo).toBe('esperar');
  });

  it('con respuestas regulares se queda de mala gana', () => {
    const c = ctxE('enojo');
    const p = conversar(c, despierta(c), ['mid', 'mid', 'no']);
    expect(p.dialogo?.fin).toBe('malaGana');
    expect(p.dialogo?.agitacion).toBeGreaterThan(CLINICA.dialogo.calma);
  });

  it('con agitación alta y malas respuestas se va (desde el segundo turno, no con una sola)', () => {
    const c = ctxE('enojo');
    const p1 = conversar(c, despierta(c), ['no']);
    expect(p1.dialogo?.fin).toBeUndefined();
    const p = conversar(c, despierta(c), ['no', 'no']);
    expect(p.dialogo?.fin).toBe('seVa');
    const fin = seguirDialogo(c, p);
    expect(fin.terminada).toBe(true);
    expect(calcularResultado(FENTANILO, fin).desenlace).toBe('riesgo');
  });

  it('cancelar la ambulancia es inseguro: quita la llamada y se refuerza en el informe', () => {
    const c = ctxE('gratitud', TARDIO);
    let p = despierta(c);
    if (p.sim.called911 === null) p = llamarEnDialogo(c, p);
    p = conversar(c, p, ['ok', 'ok']);
    const turno = c.dialogos.mayor?.turnos[2];
    const k = p.dialogo?.orden.find((i) => turno?.o[i]?.accion === 'cancelar');
    expect(k).toBeDefined();
    p = responderDialogo(c, p, k as number);
    expect(p.sim.called911).toBeNull();
    expect(p.flags).toContain('cancelo_ambulancia');
    const fin = jugar(c, 'cpr_trained', mejor, undefined, p).p;
    expect(calcularResultado(TARDIO, fin).reforzar.map((x) => x.textKey)).toContain('retro.reforzar.cancelar');
  });
});

describe('los cuatro casos con el mismo árbol y el mismo motor', () => {
  // Caso 4: lleva rato en paro cuando lo encuentran. La calibración del motor (engine.test.js, "tardio: RCP
  // inmediata") ya da posible daño aun con la mejor respuesta después de revisar respuesta y respiración.
  const esperado: Record<string, string[]> = { tardio: ['sobrevive', 'dano'] };
  it.each(Object.values(CASOS_ARBOL))('$id: con las mejores respuestas sobrevive y completa las acciones críticas', (caso) => {
    for (const perfil of PERFILES) {
      const c = ctxDe(caso);
      const { p } = jugar(c, perfil, mejor);
      expect(p.terminada).toBe(true);
      const r = calcularResultado(caso, p);
      expect(esperado[caso.id] ?? ['sobrevive']).toContain(r.desenlace);
      expect(r.reforzar.filter((x) => x.textKey.startsWith('retro.falta.'))).toEqual([]);
    }
  });

  it('caso 4 (paro): llama y empieza la RCP de inmediato, antes de la naloxona', () => {
    const c = ctxDe(TARDIO);
    const p = jugar(c, 'cpr_trained', mejor, (q) => q.nodo === 'llamar_paro').p;
    expect(p.nodo).toBe('llamar_paro');
    expect(p.sim.doses).toHaveLength(0);
    const q = elegir(c, p, 'altavoz_rcp');
    expect(q.nodo).toBe('rcp');
    expect(q.sim.t).toBeLessThanOrEqual(60);
    expect(opcionesDisponibles(c, q).map((o) => o.id)).toEqual(expect.arrayContaining(['rcp_30_2', 'naloxona']));
    const fin = jugar(c, 'cpr_trained', mejor, undefined, q).p;
    const primeraRcp = fin.registro.find((r) => r.opcion === 'rcp_30_2')?.t ?? Infinity;
    expect(primeraRcp).toBeLessThan(fin.sim.doses[0]?.t ?? Infinity);
  });

  it('caso 4: dar la naloxona antes de la RCP en paro se marca como incorrecto', () => {
    const c = ctxDe(TARDIO);
    const p = elegir(c, jugar(c, 'cpr_trained', mejor, (q) => q.nodo === 'llamar_paro').p, 'naloxona_primero');
    expect(p.registro.at(-1)?.calidad).toBe('incorrecta');
    expect(p.nodo).toBe('naloxona');
  });

  it('caso 3 (xilazina): respira por su cuenta pero sigue dormido; no se ofrece otra dosis y no despierta', () => {
    const c = ctxDe(XILAZINA);
    const { p } = jugar(c, 'cpr_trained', mejor);
    expect(p.sim.awakeAt).toBeNull();
    expect(p.sim.doses).toHaveLength(1);
    expect(p.flags).toContain('llego_lateral');
    expect(p.fin).toBe('ems');
    const enVigilar = jugar(c, 'cpr_trained', mejor, (q) => q.nodo === 'vigilar' && q.sim.t > 400).p;
    expect(opcionesDisponibles(c, enVigilar).map((o) => o.id)).not.toContain('segunda_dosis');
  });

  it('caso 2 (adolescente): no llamar "para que nadie se meta en problemas" se explica y no avanza', () => {
    const c = ctxDe(PASTILLAS);
    const p = elegir(c, jugar(c, 'cpr_trained', mejor, (q) => q.nodo === 'llamar').p, 'no_llamar');
    expect(p.nodo).toBe('llamar');
    expect(p.registro.at(-1)?.feedbackKey).toBe('fb.llamar.no_llamar');
    expect(p.sim.called911).toBeNull();
  });

  it('caso 2: al despertar conversa con el perfil de adolescente', () => {
    const c = ctxDe(PASTILLAS);
    const p = jugar(c, 'cpr_trained', mejor, (q) => q.nodo === 'despierta').p;
    expect(p.nodo).toBe('despierta');
    expect(c.dialogos.joven?.variantes[p.dialogo?.variante ?? -1]).toBeDefined();
  });
});

describe('retroalimentación final', () => {
  it('la mejor respuesta completa las acciones críticas y no deja nada que reforzar', () => {
    const r = calcularResultado(FENTANILO, jugar(ctx, 'cpr_trained', mejor).p);
    expect(r.reforzar).toEqual([]);
    expect(r.completadas.map((x) => x.id)).toEqual(expect.arrayContaining(['comprobar_respuesta', 'evaluar_respiracion', 'llamar_911', 'naloxona', 'apoyo_respiratorio', 'no_dejar_sola']));
    expect(r.mensajeCentralKey).toBe('retro.mensaje_central');
    expect(r.revision.estado).toBe('pendiente');
  });

  it('irse del lugar: no se quedó con la persona', () => {
    let p = hasta('vigilar');
    p = elegir(ctx, p, 'irse');
    expect(p.terminada).toBe(true);
    expect(p.fin).toBe('irse');
    const r = calcularResultado(FENTANILO, p);
    expect(r.reforzar.map((x) => x.id)).toContain('no_dejar_sola');
  });

  it('los mitos se refuerzan', () => {
    let p = hasta('responde');
    p = elegir(ctx, p, 'agua');
    const r = calcularResultado(FENTANILO, jugar(ctx, 'cpr_trained', mejor, undefined, p).p);
    expect(r.reforzar.map((x) => x.textKey)).toContain('fb.responde.agua');
    expect(r.reforzar.map((x) => x.textKey)).not.toContain('retro.reforzar.mitos'); // sin repetir lo mismo
  });
});

describe('recorrido al azar', () => {
  it('800 partidas al azar (los cuatro casos) siempre terminan, el tiempo nunca retrocede y se visitan todos los nodos y opciones', () => {
    const nodos = new Set<string>();
    const opciones = new Set<string>();
    const contextos = Object.values(CASOS_ARBOL).map((caso) => ctxDe(caso));
    for (let i = 0; i < 800; i++) {
      const c = contextos[i % contextos.length] as typeof ctx;
      const r = semilla(1000 + i);
      const perfil = PERFILES[i % 3] as Partida['perfil'];
      let p = crearPartida(c, perfil);
      nodos.add(p.nodo);
      const pol = alAzar(r);
      for (let k = 0; k < 400 && !p.terminada; k++) {
        const t0 = p.sim.t;
        p = pol(c, p);
        expect(p.sim.t).toBeGreaterThanOrEqual(t0);
        nodos.add(p.nodo);
      }
      expect(p.terminada).toBe(true);
      for (const x of p.registro) opciones.add(`${x.nodo}.${x.opcion}`);
    }
    const noVisitados = ARBOL.nodes.filter((n) => n.type !== 'assessment' && !nodos.has(n.id)).map((n) => n.id);
    expect(noVisitados).toEqual([]);
    // Las opciones "llamar si nadie ha llamado" casi nunca salen al azar (el árbol exige llamar antes de la
    // naloxona); se prueban aparte, abajo.
    const todas = ARBOL.nodes.flatMap((n) => (n.options ?? []).filter((o) => !o.requiere?.includes('sin_911')).map((o) => `${n.id}.${o.id}`));
    expect(todas.filter((o) => !opciones.has(o))).toEqual([]);
  });

  it.each(['vigilar', 'esperar'])('en "%s", si nadie ha llamado al 9-1-1, se ofrece llamar y queda registrado', (id) => {
    const base = id === 'vigilar' ? hasta('vigilar') : jugar(ctx, 'cpr_trained', mejor, (q) => q.nodo === 'esperar').p;
    expect(base.nodo).toBe(id);
    const sinLlamar: Partida = { ...base, sim: { ...base.sim, called911: null } };
    expect(ids(sinLlamar)).toContain('llamar');
    const p = elegir(ctx, sinLlamar, 'llamar');
    expect(p.sim.called911).toBe(sinLlamar.sim.t);
    if (id === 'esperar') expect(ids(p)).toContain('quedarse');
  });
});
