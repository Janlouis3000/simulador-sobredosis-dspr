// Informe final: acciones críticas completadas, acciones a reforzar, perfil y habilidades practicadas, tiempos,
// mensaje central, recursos de ayuda, fecha de revisión clínica y aviso. No es una puntuación.
import { useEffect, useRef } from 'react';
import { CONTACTOS } from '../../content/recursos';
import type { SimulationResult } from '../../sim/tipos';
import { mmss, useT } from '../idioma';

interface Props {
  resultado: SimulationResult;
  lecciones: string[];
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

export function Informe({ resultado: r, lecciones, onRepetir, onOtro, onRepasar }: Props) {
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
