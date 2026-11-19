// Informe final: acciones críticas completadas, acciones a reforzar, perfil y habilidades practicadas, tiempos,
// mensaje central, recursos de ayuda, fecha de revisión clínica y aviso. No es una puntuación.
import { useEffect, useRef } from 'react';
import { CONTACTOS } from '../../content/recursos';
import type { SimulationResult } from '../../sim/tipos';
import { mmss, useT } from '../idioma';

export interface DecisionInforme { opcion: string; explicacion: string; calidad: 'correcta' | 'aceptable' | 'incorrecta' }

interface Props {
  resultado: SimulationResult;
  lecciones: string[];
  /** Cada decisión del registro, en orden, con su explicación (también las de la práctica de naloxona). */
  decisiones: DecisionInforme[];
  onRepetir: () => void;
  onOtro: () => void;
  onRepasar: () => void;
}

export function Contactos() {
  const { t } = useT();
  return (
    <section className="panel contactos" aria-labelledby="contactos-titulo">
      <h3 id="contactos-titulo">{t('contacto.titulo')}</h3>
      <ul>
        {CONTACTOS.map((c) => (
          <li key={c.id}>
            <span>{t(c.labelKey)}{c.availabilityKey ? ` (${t(c.availabilityKey)})` : ''}</span>
            <a href={c.href} {...(c.type === 'url' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{c.value}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

const GRUPOS_NAPRO = [1, 2, 3, 4];

/**
 * Bloque de la División como en el inicio del simulador clásico: el Programa de Navegadores (NaPro) en azul y los
 * contactos al lado. Los textos son los mismos del clásico (DIVISION_HTML en content.js); aquí los contactos son
 * enlaces reales.
 */
export function Navegadores() {
  const { t } = useT();
  return (
    <section className="division" aria-labelledby="napro-titulo">
      <div className="a">
        <span className="eyebrow">{t('napro.etiqueta')}</span>
        <h2 id="napro-titulo">{t('napro.titulo')}</h2>
        <p>{t('napro.texto')}</p>
        <ul>{GRUPOS_NAPRO.map((k) => <li key={k}>{t(`napro.grupo.${k}`)}</li>)}</ul>
      </div>
      <ul className="b">
        {CONTACTOS.map((c) => (
          <li key={c.id} className="contact">
            <span>{t(c.labelKey)}{c.availabilityKey ? `, ${t(c.availabilityKey)}` : ''}</span>
            <a href={c.href} {...(c.type === 'url' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{c.value}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tríada de la sobredosis por opioides, con los mismos dibujos y textos del inicio del simulador clásico. */
export function Triada() {
  const { t } = useT();
  return (
    <section className="panel" aria-labelledby="triada-titulo">
      <h2 id="triada-titulo" className="triada-titulo">{t('triada.titulo')}</h2>
      <div className="triad">
        <div>
          <svg viewBox="0 0 52 40" width="52" height="40" aria-hidden="true" focusable="false"><path d="M3 20 Q26 -2 49 20 Q26 42 3 20Z" fill="#fff" stroke="#1C2854" strokeWidth="2.5" /><circle cx="26" cy="20" r="9" fill="#6b4a2f" /><circle cx="26" cy="20" r="2" fill="#111" /></svg>
          {t('triada.pupilas')}
        </div>
        <div>
          <svg viewBox="0 0 52 40" width="52" height="40" aria-hidden="true" focusable="false"><path d="M26 6 V20 M26 20 Q18 14 12 18 Q6 26 9 34 Q14 37 20 33 Q24 30 24 22 M26 20 Q34 14 40 18 Q46 26 43 34 Q38 37 32 33 Q28 30 28 22" fill="none" stroke="#1C2854" strokeWidth="2.5" strokeLinecap="round" /></svg>
          {t('triada.respirar')}
        </div>
        <div>
          <svg viewBox="0 0 52 40" width="52" height="40" aria-hidden="true" focusable="false"><circle cx="10" cy="28" r="6" fill="#1C2854" /><rect x="17" y="24" width="30" height="9" rx="4.5" fill="#1C2854" /><text x="34" y="16" fontSize="12" fontWeight="700" fill="#e5bc44" fontFamily="Poppins, sans-serif">Z z</text></svg>
          {t('triada.no_responde')}
        </div>
      </div>
      <p className="triad-cap">{t('triada.otros')}</p>
    </section>
  );
}

export function Informe({ resultado: r, lecciones, decisiones, onRepetir, onOtro, onRepasar }: Props) {
  const { t } = useT();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, []);
  const tiempo = (x: number | null) => (x === null ? t('resultado.no_ocurrio') : mmss(x));
  const tono = r.desenlace === 'sobrevive' ? '' : r.desenlace === 'muerte' ? 'muerte' : 'riesgo';
  return (
    <div className="informe">
      <h2 ref={titulo} tabIndex={-1}>{t('resultado.titulo')}</h2>
      <div className={`verdict ${tono}`}>
        <h3>{t(`resultado.desenlace.${r.desenlace}`)}</h3>
        <p><b>{t(r.mensajeCentralKey)}</b></p>
      </div>

      <div className="two">
        <section className="panel" aria-labelledby="inf-criticas">
          <h3 id="inf-criticas">{t('resultado.criticas')}</h3>
          {r.completadas.length
            ? <ul className="checklist">{r.completadas.map((x) => <li key={x.id}><span className="mark ok" aria-hidden="true">✓</span><span>{t(x.textKey, x.vars)}</span></li>)}</ul>
            : <p>{t('resultado.ninguna')}</p>}
        </section>
        <section className="panel" aria-labelledby="inf-reforzar">
          <h3 id="inf-reforzar">{t('resultado.reforzar')}</h3>
          {r.reforzar.length
            ? <ul className="checklist">{r.reforzar.map((x) => <li key={x.id}><span className="mark mid" aria-hidden="true">!</span><span>{t(x.textKey, x.vars)}</span></li>)}</ul>
            : <p>{t('resultado.ninguna')}</p>}
        </section>
      </div>

      <div className="two">
        <section className="panel" aria-labelledby="inf-practicado">
          <h3 id="inf-practicado">{t('resultado.practicado')}</h3>
          <p><b>{t('resultado.perfil')}:</b> {t(`retro.perfil.${r.perfil}`)}</p>
          <ul className="lessons">{r.practicadas.filter((x) => x.id !== 'perfil').map((x) => <li key={x.id}>{t(x.textKey)}</li>)}</ul>
        </section>
        <section className="panel" aria-labelledby="inf-tiempos">
          <h3 id="inf-tiempos">{t('resultado.tiempos')}</h3>
          <dl className="tiempos">
            <dt>{t('resultado.t_llamada')}</dt><dd>{tiempo(r.tiempos.llamada)}</dd>
            <dt>{t('resultado.t_dosis')}</dt><dd>{tiempo(r.tiempos.primeraDosis)}</dd>
            <dt>{t('resultado.t_apoyo')}</dt><dd>{tiempo(r.tiempos.primerApoyo)}</dd>
            <dt>{t('resultado.t_total')}</dt><dd>{mmss(r.tiempos.total)}</dd>
          </dl>
        </section>
      </div>

      {decisiones.length > 0 && (
        <details className="panel decisiones">
          <summary>{t('resultado.decisiones')}</summary>
          <ol className="checklist">
            {decisiones.map((d, i) => {
              const c = d.calidad === 'correcta' ? 'ok' : d.calidad === 'aceptable' ? 'mid' : 'no';
              return (
                <li key={i}>
                  <span className={`mark ${c}`} aria-hidden="true">{c === 'ok' ? '✓' : c === 'mid' ? '!' : '✕'}</span>
                  <span><b><span className="solo-lector">{t(`resumen.${d.calidad}`)}: </span>{d.opcion}</b>{d.explicacion && <small>{d.explicacion}</small>}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {lecciones.length > 0 && (
        <section className="panel" aria-labelledby="inf-lecciones">
          <h3 id="inf-lecciones">{t('resultado.lecciones')}</h3>
          <ul className="lessons">{lecciones.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>
      )}

      <div className="row acciones-fin">
        <button type="button" className="btn primary" onClick={onRepetir}>{t('resultado.repetir')}</button>
        <button type="button" className="btn" onClick={onOtro}>{t('resultado.otro')}</button>
        <button type="button" className="btn" onClick={onRepasar}>{t('resultado.repasar')}</button>
      </div>

      <h3>{t('resultado.recursos')}</h3>
      <Contactos />
      <p className="note">
        {t('resultado.revision', {
          estado: t(`resultado.revision.${r.revision.estado}`),
          fecha: r.revision.fecha ?? t('resultado.revision.sin_fecha'),
        })}
      </p>
      <p className="note">{t('resultado.aviso')}</p>
    </div>
  );
}
