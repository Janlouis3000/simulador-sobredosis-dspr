// Aplicación del simulador por pasos. Flujo: menú → (tutorial) → escenarios → modo y perfil → simulación → informe.
import { useEffect, useMemo, useRef, useState } from 'react';
import { registrar } from '../analitica';
import { IDIOMA } from '../i18n/i18n';
import { CASOS_ARBOL, FENTANILO } from '../sim/casos/casos';
import { crearPartida } from '../sim/interprete';
import { calcularResultado } from '../sim/retro';
import { PERFILES } from '../sim/tipos';
import type { Modo, Partida, TrainingProfile } from '../sim/tipos';
import { Controles } from './componentes/Controles';
import { Informe, Navegadores, Triada } from './componentes/Informe';
import { DemoNaloxona } from './componentes/DemoNaloxona';
import { Simulacion } from './componentes/Simulacion';
import { crearContexto, leccionesDe } from './contexto';
import { IdiomaContexto, TRADUCTOR } from './idioma';
import { MINIATURAS, precargarEscena } from './miniaturas';
import { textoDecision } from './registro';

type Pantalla = 'menu' | 'pregunta_tutorial' | 'tutorial' | 'controles' | 'escenarios' | 'modo' | 'sim' | 'repaso';

const MODOS: Modo[] = ['guiado', 'sin_guia'];
const PASOS_TUTORIAL = [1, 2, 3, 4, 5];
const params = new URLSearchParams(location.search);

export function App() {
  const { t } = TRADUCTOR;
  const [casoId, setCasoId] = useState('fentanilo');
  // Perfil predeterminado: con capacitación en RCP. Modo predeterminado: guiado (recomendado la primera vez).
  const [perfil, setPerfil] = useState<TrainingProfile>('cpr_trained');
  const [modo, setModo] = useState<Modo>('guiado');
  const [pantalla, setPantalla] = useState<Pantalla>('menu');
  const [partida, setPartida] = useState<Partida | null>(null);
  const [intento, setIntento] = useState(0);
  const [tutorialVisto, setTutorialVisto] = useState(false);
  const caso = CASOS_ARBOL[casoId] ?? FENTANILO;
  const ctx = useMemo(() => crearContexto(caso, { emocionFija: params.get('emocion') }), [caso]);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Siempre español de Puerto Rico (también está en arbol.html; esto lo asegura si la página se incrusta distinto).
  useEffect(() => { document.documentElement.lang = IDIOMA; }, []);
  // Al cambiar de pantalla, el foco va a su título (teclado y lectores de pantalla).
  useEffect(() => { if (pantalla !== 'sim' && pantalla !== 'repaso') titulo.current?.focus(); }, [pantalla]);

  const comenzar = () => {
    registrar(partida ? 'scenario_repeated' : 'scenario_started', { caso: caso.id, perfil, modo });
    setPartida(crearPartida(ctx, perfil));
    setIntento((x) => x + 1);
    setPantalla('sim');
  };
  const alMenu = () => { setPartida(null); setPantalla('menu'); };
  // Al terminar: desenlace y acciones críticas que faltaron (solo identificadores, nada que identifique a nadie).
  const terminada = partida?.terminada ?? false;
  useEffect(() => {
    if (!terminada || !partida) return;
    const r = calcularResultado(caso, partida);
    registrar('scenario_completed', { caso: caso.id, perfil: partida.perfil, desenlace: r.desenlace });
    for (const x of r.reforzar) if (x.textKey.startsWith('retro.falta.')) registrar('critical_action_missed', { caso: caso.id, accion: x.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminada]);

  const botonMenu = <button type="button" className="btn" onClick={alMenu}>{t('menu.volver')}</button>;

  return (
    <IdiomaContexto.Provider value={TRADUCTOR}>
      <div className="arbol-app">
        {pantalla === 'menu' && (
          <section className="pantalla menu" aria-labelledby="pantalla-titulo">
            {/* Mismo formato que el inicio del simulador clásico: título y tríada, y debajo el Programa de Navegadores. */}
            <div className="hero">
              <div className="hero-text">
                <span className="eyebrow">{t('app.titulo')}</span>
                <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('inicio.titulo')}</h1>
                <p className="lead">{t('inicio.lead')}</p>
                <div className="menu-botones">
                  <button type="button" className="btn primary" onClick={() => setPantalla(tutorialVisto ? 'escenarios' : 'pregunta_tutorial')}>{t('menu.jugar')}</button>
                  <button type="button" className="btn" onClick={() => setPantalla('tutorial')}>{t('menu.tutorial')}</button>
                  <button type="button" className="btn" onClick={() => setPantalla('controles')}>{t('menu.controles')}</button>
                  <button type="button" className="btn" onClick={() => setPantalla('repaso')}>{t('menu.naloxona')}</button>
                </div>
              </div>
              <Triada />
            </div>
            <Navegadores />
            <p className="note">{t('inicio.aviso')}</p>
            <p className="note"><a href="./index.html">{t('app.clasico')}</a></p>
          </section>
        )}

        {pantalla === 'pregunta_tutorial' && (
          <section className="pantalla" aria-labelledby="pantalla-titulo">
            <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('tutorial.pregunta.titulo')}</h1>
            <p className="lead">{t('tutorial.pregunta.texto')}</p>
            <div className="menu-botones">
              <button type="button" className="btn primary" onClick={() => setPantalla('tutorial')}>{t('tutorial.ver')}</button>
              <button type="button" className="btn" onClick={() => { setTutorialVisto(true); setPantalla('escenarios'); }}>{t('tutorial.saltar')}</button>
              {botonMenu}
            </div>
          </section>
        )}

        {pantalla === 'tutorial' && (
          <section className="pantalla" aria-labelledby="pantalla-titulo">
            <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('tutorial.titulo')}</h1>
            <ol className="tutorial">{PASOS_TUTORIAL.map((k) => <li key={k}>{t(`tutorial.paso.${k}`)}</li>)}</ol>
            <div className="menu-botones">
              <button type="button" className="btn primary" onClick={() => { setTutorialVisto(true); setPantalla('escenarios'); }}>{t('tutorial.saltar')}</button>
              <button type="button" className="btn" onClick={() => setPantalla('controles')}>{t('menu.controles')}</button>
              {botonMenu}
            </div>
          </section>
        )}

        {pantalla === 'controles' && (
          <section className="pantalla" aria-labelledby="pantalla-titulo">
            <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('controles.titulo')}</h1>
            <Controles />
            <div className="menu-botones">{botonMenu}</div>
          </section>
        )}

        {pantalla === 'escenarios' && (
          <section className="pantalla" aria-labelledby="pantalla-titulo">
            <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('escenarios.titulo')}</h1>
            <p className="lead">{t('escenarios.texto')}</p>
            <ul className="escenarios">
              {Object.values(CASOS_ARBOL).map((c) => (
                <li key={c.id}>
                  <button type="button" className="escenario" onClick={() => { setCasoId(c.id); precargarEscena(c.motor); setPantalla('modo'); }}>
                    <img src={MINIATURAS[c.motor]} alt="" width={960} height={600} />
                    <span className="escenario-texto">
                      <b>{t(c.tituloKey)}</b>
                      <span>{t(`caso.${c.id}.corto`)}</span>
                      <small>{t(c.lugarKey)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="menu-botones">{botonMenu}</div>
          </section>
        )}

        {pantalla === 'modo' && (
          <section className="pantalla" aria-labelledby="pantalla-titulo">
            <span className="eyebrow">{t(caso.tituloKey)} · {t(caso.lugarKey)}</span>
            <h1 id="pantalla-titulo" ref={titulo} tabIndex={-1}>{t('modo.titulo')}</h1>
            <fieldset className="panel">
              <legend>{t('modo.texto')}</legend>
              {MODOS.map((m) => (
                <label key={m} className="opcion-radio">
                  <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => setModo(m)} aria-describedby={`ayuda-modo-${m}`} />
                  <span><b>{t(`modo.${m}`)}</b><small id={`ayuda-modo-${m}`}>{t(`modo.${m}.ayuda`)}</small></span>
                </label>
              ))}
            </fieldset>
            <fieldset className="panel">
              <legend>{t('inicio.perfil.pregunta')}</legend>
              {PERFILES.map((p) => (
                <label key={p} className="opcion-radio">
                  <input type="radio" name="perfil" value={p} checked={perfil === p} onChange={() => setPerfil(p)} aria-describedby={`ayuda-${p}`} />
                  <span><b>{t(`inicio.perfil.${p}`)}</b><small id={`ayuda-${p}`}>{t(`inicio.perfil.ayuda.${p}`)}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="menu-botones">
              <button type="button" className="btn primary" onClick={comenzar}>{t('inicio.comenzar')}</button>
              <button type="button" className="btn" onClick={() => setPantalla('escenarios')}>{t('escenarios.volver')}</button>
              {botonMenu}
            </div>
          </section>
        )}

        {pantalla === 'sim' && partida && !partida.terminada && (
          <Simulacion key={intento} ctx={ctx} partida={partida} modo={modo} setPartida={setPartida} onReiniciar={comenzar} onMenu={alMenu} />
        )}
        {pantalla === 'sim' && partida?.terminada && (
          <Informe
            resultado={calcularResultado(caso, partida)}
            lecciones={leccionesDe(caso.motor)}
            decisiones={partida.registro.map((e) => ({ ...textoDecision(ctx, e, t), calidad: e.calidad }))}
            onRepetir={comenzar}
            onOtro={() => { setPartida(null); setPantalla('escenarios'); }}
            onRepasar={() => setPantalla('repaso')}
          />
        )}
        {pantalla === 'repaso' && (
          <DemoNaloxona textoFin={t('demo.volver')} onFin={() => setPantalla(partida ? 'sim' : 'menu')} />
        )}
      </div>
    </IdiomaContexto.Provider>
  );
}
