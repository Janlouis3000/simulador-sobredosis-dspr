// Pantalla de la simulación: muestra el nodo actual del árbol en HTML semántico. Toda la información crítica
// (signos, opciones, retroalimentación) está en texto, no en un canvas. El tiempo solo avanza al decidir.
import { useEffect, useRef, useState } from 'react';
import { EMS_DELAY } from '../../engine';
import { CLINICA } from '../../sim/config/clinica';
import {
  avanzarInformacion, elegir, llamarEnDialogo, marcarDemoVista, nodo, opcionesDisponibles, perfilDialogo, practicarNaloxona,
  quedanDispositivos, responderDialogo, seguirDialogo,
} from '../../sim/interprete';
import type { Contexto } from '../../sim/interprete';
import type { AccionMotor } from '../../engine';
import { faltaParaDosis } from '../../sim/observaciones';
import { FASES } from '../../sim/tipos';
import type { DecisionOption, EntradaRegistro, Fase, Modo, Partida } from '../../sim/tipos';
import { estadoEscena, poseDe } from '../estadoEscena';
import { mmss, useT } from '../idioma';
import { textoDecision } from '../registro';
import { DemoNaloxona } from './DemoNaloxona';
import { Escena3D } from './Escena3D';
import type { Marca } from './Escena3D';

interface Props { ctx: Contexto; partida: Partida; modo: Modo; setPartida: (p: Partida) => void; onReiniciar: () => void; onMenu: () => void }
/** Cambia de partida. conRetro: mostrar la explicación de la decisión que se acaba de tomar. */
type Ir = (p: Partida, conRetro: boolean) => void;
interface PropsHijo { ctx: Contexto; partida: Partida; ir: Ir; modo: Modo }

/** Segundos reales que se ve la RCP o las respiraciones en la escena después de escogerlas. */
const VER_ACCION_MS = 6000;

export function Simulacion({ ctx, partida, modo, setPartida, onReiniciar, onMenu }: Props) {
  const { t } = useT();
  const n = nodo(ctx, partida.nodo);
  const titulo = useRef<HTMLHeadingElement>(null);
  const s = partida.sim;
  const guiado = modo === 'guiado';
  // Qué mostrar como "lo último que pasó": las observaciones nuevas y la explicación de la última decisión.
  const [desde, setDesde] = useState({ obs: 0, retro: -1 });
  // Resumen al terminar una fase (evaluación, pedir ayuda y naloxona, apoyo): lo que se hizo y su explicación.
  const [resumen, setResumen] = useState<{ fase: Fase; entradas: EntradaRegistro[] } | null>(null);
  const faseMax = useRef(0);
  const resumidas = useRef(0);
  const [anim, setAnim] = useState<AccionMotor>('none');
  const [pupilas, setPupilas] = useState(0);
  const reloj = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(reloj.current), []);

  const ordenFase = (id: string) => Math.max(0, FASES.indexOf(nodo(ctx, id).fase ?? 'evaluar'));
  const ir: Ir = (p, conRetro) => {
    const f = ordenFase(p.nodo);
    if (f > faseMax.current && !p.terminada) {
      const entradas = p.registro.slice(resumidas.current);
      if (entradas.length) setResumen({ fase: FASES[faseMax.current] ?? 'evaluar', entradas });
      resumidas.current = p.registro.length;
      faseMax.current = f;
    }
    setDesde({ obs: partida.observaciones.length, retro: conRetro ? p.registro.length : -1 });
    setPartida(p);
  };
  const escoger = (o: DecisionOption) => {
    const accion = o.effects?.accionMotor;
    window.clearTimeout(reloj.current);
    if (accion && accion !== 'none') {
      setAnim(accion);
      reloj.current = window.setTimeout(() => setAnim('none'), VER_ACCION_MS);
    } else setAnim('none');
    if (o.effects?.flags?.includes('vio_pupilas')) setPupilas((x) => x + 1);
    ir(elegir(ctx, partida, o.id), true);
  };
  const enfoque = `${partida.nodo}|${partida.registro.length}|${partida.dialogo?.turno ?? ''}|${partida.dialogo?.ultima ? 1 : 0}|${resumen ? 1 : 0}`;
  useEffect(() => { titulo.current?.focus(); }, [enfoque]);

  const ultima = desde.retro === partida.registro.length ? partida.registro[partida.registro.length - 1] : undefined;
  const nuevas = partida.observaciones.slice(desde.obs);
  const prompt = n.promptKeyPorPerfil?.[partida.perfil] ?? n.promptKey;
  const quedan = CLINICA.dispositivosEnKit - s.doses.length;
  const opciones = resumen || !(n.type === 'choice' || n.type === 'cpr_practice') ? [] : opcionesDisponibles(ctx, partida);
  // Iconos sobre la escena: las opciones del paso que tienen un lugar en el cuerpo o en un objeto.
  const marcas: Marca[] = opciones.filter((o) => o.ancla && o.icono).map((o) => ({
    id: `${n.id}.${o.id}`, ancla: o.ancla as Marca['ancla'], icono: o.icono as Marca['icono'], etiqueta: t(o.labelKey), onClick: () => escoger(o),
  }));
  if (!resumen && n.type === 'naloxone_practice') marcas.push({
    id: 'kit', ancla: 'kit', icono: 'naloxona', etiqueta: t('escena.kit'),
    onClick: () => document.getElementById('paso-titulo')?.scrollIntoView({ block: 'start' }),
  });
  // En un paro la naloxona se da durante la RCP, así que el resumen de "pedir ayuda" todavía no la incluye.
  const faseDelResumen = resumen?.fase === 'ayuda' && !resumen.entradas.some((e) => e.nodo === 'naloxona') ? 'fase.ayuda_sola' : `fase.${resumen?.fase ?? 'evaluar'}`;
  const pose = poseDe(partida, anim);

  return (
    <div className="sim-arbol">
      <div className="estado" role="status">
        <span><b>{t('sim.tiempo')}:</b> {mmss(s.t)}</span>
        <span><b>{t('sim.ambulancia')}:</b> {s.called911 === null ? t('sim.sin_llamar')
          : s.t >= s.called911 + EMS_DELAY ? t('sim.llego') : t('sim.llega_en', { tiempo: mmss(s.called911 + EMS_DELAY - s.t) })}</span>
        <span>{t('sim.dispositivos', { quedan, total: CLINICA.dispositivosEnKit })}</span>
        <span>{t('sim.perfil', { perfil: t(`inicio.perfil.${partida.perfil}`) })}</span>
      </div>

      <div className="sim-grid">
      <Escena3D
        motor={ctx.caso.motor}
        estado={estadoEscena(partida, anim, ctx.dialogos[ctx.caso.dialogo])}
        marcas={marcas}
        lugar={t(ctx.caso.lugarKey)}
        descripcion={t('escena.alt', { lugar: t(ctx.caso.lugarKey), posicion: t(`escena.pos.${pose}`) })}
        pupilas={pupilas}
        haciendo={anim === 'none' ? undefined : t(`escena.haciendo.${anim}`)}
      />
      <div className="sim-col">
      {/* Lo último que pasó: retroalimentación de la decisión y lo que se observa. Se anuncia sin mover el foco.
          En el modo sin guía la explicación no sale aquí: llega en el resumen de la fase y en el informe. */}
      <div aria-live="polite" className="ultimo">
        {guiado && !resumen && ultima?.feedbackKey && (
          <div className={`feedback ${ultima.calidad === 'correcta' ? 'ok' : ultima.calidad === 'aceptable' ? 'mid' : 'no'}`}>
            <b>{t('sim.tu_decision')}:</b> {t(ultima.feedbackKey)}
          </div>
        )}
        {nuevas.length > 0 && (
          <div className="panel observa">
            <h3>{t('obs.titulo')}</h3>
            <ul>{nuevas.map((o, k) => <li key={`${o.clave}-${k}`}>{t(o.clave, o.vars)}</li>)}</ul>
          </div>
        )}
      </div>

      {resumen ? (
        <section className="panel paso" aria-labelledby="paso-titulo">
          <h2 id="paso-titulo" ref={titulo} tabIndex={-1}>{t('resumen.titulo', { fase: t(faseDelResumen) })}</h2>
          <ul className="checklist">
            {resumen.entradas.map((e, k) => {
              const c = e.calidad === 'correcta' ? 'ok' : e.calidad === 'aceptable' ? 'mid' : 'no';
              const { opcion, explicacion } = textoDecision(ctx, e, t);
              return (
                <li key={k}>
                  <span className={`mark ${c}`} aria-hidden="true">{c === 'ok' ? '✓' : c === 'mid' ? '!' : '✕'}</span>
                  <span><b><span className="solo-lector">{t(`resumen.${e.calidad}`)}: </span>{opcion}</b>{explicacion && <small>{explicacion}</small>}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn primary" onClick={() => setResumen(null)}>{t('sim.continuar')}</button>
        </section>
      ) : (
      <section className="panel paso" aria-labelledby="paso-titulo">
        <h2 id="paso-titulo" ref={titulo} tabIndex={-1}>{t(prompt)}</h2>
        {n.requiereRevisionClinica && <p className="revision">{t('sim.revision')}</p>}
        {guiado && n.pistaKey && <p className="pista"><b>{t('sim.pista')}:</b> {t(n.pistaKey)}</p>}

        {n.type === 'information' && (
          <>
            {n.id === 'encontrar' && <p className="lead">{t(ctx.caso.introKey)}</p>}
            {n.id === 'aviso' && (
              <>
                <p className="lead">{t('nodo.aviso.texto')}</p>
                <h3>{t('objetivo.titulo')}</h3>
                <ul className="lessons">{ctx.caso.objetivos.map((o) => <li key={o.id}>{t(o.textKey)}</li>)}</ul>
              </>
            )}
            <button type="button" className="btn primary" onClick={() => ir(avanzarInformacion(ctx, partida), false)}>{t('sim.continuar')}</button>
          </>
        )}

        {(n.type === 'choice' || n.type === 'cpr_practice') && (
          <>
            {n.id === 'decidir' && s.doses.length > 0 && quedanDispositivos(s) && faltaParaDosis(s) > 0 && (
              <p className="note">{t('sim.falta_dosis', { seg: Math.ceil(faltaParaDosis(s)) })}</p>
            )}
            {n.id === 'decidir' && !quedanDispositivos(s) && <p className="note">{t('sim.sin_dispositivos', { total: CLINICA.dispositivosEnKit })}</p>}
            <div className="opts" role="group" aria-label={t('sim.opciones')}>
              {opciones.map((o) => (
                <button key={o.id} type="button" className="btn opcion" onClick={() => escoger(o)}>{t(o.labelKey)}</button>
              ))}
            </div>
          </>
        )}

        {n.type === 'naloxone_practice' && <PracticaNaloxona ctx={ctx} partida={partida} ir={ir} modo={modo} />}
        {n.type === 'dialogue' && <Dialogo ctx={ctx} partida={partida} ir={ir} modo={modo} />}
      </section>
      )}
      </div>
      </div>

      <div className="row">
        <button type="button" className="btn ghost reiniciar" onClick={onReiniciar}>{t('sim.reiniciar')}</button>
        <button type="button" className="btn ghost" onClick={onMenu}>{t('menu.volver')}</button>
      </div>
    </div>
  );
}

// ---------- Práctica de naloxona ----------
// Práctica de la naloxona. Modo guiado: después de cada decisión se explica si la técnica fue correcta. Modo sin guía:
// solo se confirma lo que se escogió y se sigue; la explicación queda en el registro y sale en el resumen de la fase
// y en el informe. En los dos modos se ven las consecuencias que hacen falta para seguir (un dispositivo perdido).
function PracticaNaloxona({ ctx, partida, ir, modo }: PropsHijo) {
  const { t } = useT();
  const guiado = modo === 'guiado';
  const yaVio = partida.flags.includes('vio_demo') || partida.sim.doses.length > 0;
  const [demo, setDemo] = useState(!yaVio);
  const [resp, setResp] = useState<number[]>([]);
  const [vista, setVista] = useState<number | null>(null);
  const foco = useRef<HTMLHeadingElement>(null);
  const retro = useRef<HTMLDivElement>(null);
  const seguir = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!demo) foco.current?.focus(); }, [demo, resp.length]);
  // Al escoger, los botones de las opciones desaparecen: el foco pasa a la explicación (guiado) o al botón para
  // seguir (sin guía), siempre a algo visible, para no perderse con el teclado.
  useEffect(() => { if (vista !== null) (guiado ? retro.current : seguir.current)?.focus(); }, [vista, guiado]);

  if (demo) {
    return <DemoNaloxona textoFin={t('demo.terminar')} onFin={(vio) => {
      setDemo(false);
      if (vio) ir(marcarDemoVista(partida), false);
    }} />;
  }
  // Si se pierde esta dosis, ¿queda otro dispositivo para intentarlo de nuevo?
  const quedaOtro = partida.sim.doses.length + 1 < CLINICA.dispositivosEnKit;
  const i = resp.length;
  const paso = ctx.practica[i];
  const elegida = vista !== null ? paso?.o[vista] : undefined;
  const perdio = elegida?.wasted === true;
  const termina = perdio || i === ctx.practica.length - 1;

  if (!paso) return null;
  return (
    <div className="practica">
      <h3 ref={foco} tabIndex={-1}>{t('practica.titulo')} · {t('practica.paso', { n: i + 1, total: ctx.practica.length })}</h3>
      <p>{paso.q}</p>
      {elegida ? (
        <>
          {guiado
            ? <div ref={retro} tabIndex={-1} className={`feedback ${elegida.ok ? 'ok' : perdio ? 'no' : 'mid'}`} aria-live="polite">{elegida.fb}</div>
            : (
              <div className="elegiste" aria-live="polite">
                <p>{t('practica.elegiste', { opcion: elegida.t })}</p>
                {/* Consecuencia que hace falta para seguir, sin explicar la técnica: el dispositivo se perdió. */}
                {perdio && <p className="consecuencia">{t('obs.naloxona.perdida')}</p>}
              </div>
            )}
          <button ref={seguir} type="button" className="btn primary" onClick={() => {
            const todas = [...resp, vista as number];
            setVista(null);
            if (termina) { setResp([]); ir(practicarNaloxona(ctx, partida, todas), true); }
            else setResp(todas);
          }}>{termina ? (perdio && quedaOtro ? t('practica.nuevo') : t('practica.dar')) : t('practica.siguiente')}</button>
        </>
      ) : (
        <div className="opts" role="group" aria-label={t('sim.opciones')}>
          {paso.o.map((o, k) => <button key={k} type="button" className="btn opcion" onClick={() => setVista(k)}>{o.t}</button>)}
        </div>
      )}
      <button type="button" className="btn ghost" onClick={() => setDemo(true)}>{t('practica.ver_demo')}</button>
    </div>
  );
}

// ---------- Conversación al despertar ----------
function Dialogo({ ctx, partida, ir, modo }: PropsHijo) {
  const { t, tg } = useT();
  const d = partida.dialogo;
  const perfil = perfilDialogo(ctx);
  if (!d) return null;
  const v = perfil.variantes[d.variante];
  const turno = perfil.turnos[d.turno];
  if (!v || !turno) return null;
  const C = CLINICA.dialogo;
  const genero = perfil.lo === 'la' ? 'f' : 'm';
  const nivel = d.agitacion >= C.etiquetaMuyAlta ? 'dialogo.muy_alta' : d.agitacion >= C.etiquetaBaja ? 'dialogo.alta' : 'dialogo.baja';
  const linea = d.turno === 0 ? v.dice : (d.agitacion >= C.lineaAlta ? turno.alta : turno.baja) ?? v.dice;
  const elegida = d.ultima ? turno.o[d.ultima.opcion] : undefined;
  const texto = (o: { t: string; accion?: string }) =>
    o.accion === 'cancelar' && partida.sim.called911 === null ? t('dialogo.cancelar_sin_911') : o.t;

  return (
    <div className="dialogo">
      <p className="eyebrow">{t('dialogo.turno', { n: d.turno + 1, total: perfil.turnos.length })}</p>
      {d.turno === 0 && <p>{v.escena}</p>}
      <p className="dice">{linea}</p>
      <div className="agit" role="meter" aria-label={t('dialogo.agitacion')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(d.agitacion)} aria-valuetext={tg(nivel, genero)}>
        <span>{t('dialogo.agitacion')}</span>
        <span className="bar"><i className={nivel === 'dialogo.muy_alta' ? 'alta' : nivel === 'dialogo.baja' ? 'baja' : ''} style={{ width: `${d.agitacion}%` }} /></span>
        <b>{tg(nivel, genero)}</b>
      </div>
      {elegida ? (
        <>
          {/* Sin guía: se ve cómo reacciona la persona (agitación), pero la explicación queda para el informe. */}
          {modo === 'guiado' && <div className={`feedback ${elegida.ok}`} aria-live="polite">{elegida.fb}</div>}
          {d.ultima?.seVa && <p className="dice">{perfil.fin.seVa}</p>}
          {d.fin === 'calma' && <p className="dice">{d.cancelo && perfil.fin.calmaSinAmbulancia ? perfil.fin.calmaSinAmbulancia : perfil.fin.calma}</p>}
          {d.fin === 'malaGana' && <p className="dice">{perfil.fin.malaGana}</p>}
          <button type="button" className="btn primary" onClick={() => ir(seguirDialogo(ctx, partida), false)}>{t('dialogo.seguir')}</button>
        </>
      ) : (
        <>
          <p className="note">{t('dialogo.que_dices')}</p>
          <div className="opts" role="group" aria-label={t('sim.opciones')}>
            {d.orden.map((k) => {
              const o = turno.o[k];
              return o ? <button key={k} type="button" className="btn opcion" onClick={() => ir(responderDialogo(ctx, partida, k), false)}>{texto(o)}</button> : null;
            })}
          </div>
          {partida.sim.called911 === null && (
            <button type="button" className="btn ghost" onClick={() => ir(llamarEnDialogo(ctx, partida), false)}>{t('dialogo.llamar')}</button>
          )}
        </>
      )}
    </div>
  );
}
