// Demostración paso a paso de la naloxona nasal: ilustración, texto visible, narración opcional y controles
// Anterior, Siguiente, Repetir y Omitir. Funciona sin 3D; si algún día hay modelos (ASSET_NALOXONA), el
// adaptador de visual/naloxona3d.ts los mostrará encima de esta misma secuencia.
import { useEffect, useRef, useState } from 'react';
import { registrar } from '../../analitica';
import { ASSET_NALOXONA, PASOS_NALOXONA } from '../../content/recursos';
import { hayModelos3D } from '../../visual/naloxona3d';
import { useT } from '../idioma';
import { IlustracionNaloxona } from './IlustracionNaloxona';

interface Props {
  /** Se llama al terminar los pasos (vista = true) o al omitir (vista = false). */
  onFin: (vista: boolean) => void;
  textoFin?: string;
}

function narrar(texto: string, idioma: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = idioma;
  window.speechSynthesis.speak(u);
}

export function DemoNaloxona({ onFin, textoFin }: Props) {
  const { t, idioma } = useT();
  const [i, setI] = useState(0);
  const [voz, setVoz] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const paso = PASOS_NALOXONA[i] ?? PASOS_NALOXONA[0];
  const total = PASOS_NALOXONA.length;
  const ultimo = i === total - 1;

  useEffect(() => { titulo.current?.focus(); }, [i]);
  useEffect(() => {
    if (voz && paso) narrar(t(paso.textKey), idioma);
  }, [voz, paso, t, idioma]);
  useEffect(() => {
    registrar('naloxone_demo_started');
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!paso) return null;
  return (
    <section className="demo" aria-labelledby="demo-titulo">
      <h3 id="demo-titulo">{t('demo.titulo')}</h3>
      {!hayModelos3D(ASSET_NALOXONA) && <p className="note">{t('demo.sin3d')}</p>}
      <div className="demo-paso">
        <IlustracionNaloxona id={paso.ilustracion} alt={t(paso.altKey)} />
        <div>
          <h4 ref={titulo} tabIndex={-1} className="demo-num">{t('demo.paso', { n: i + 1, total })}</h4>
          <p className="demo-texto" aria-live="polite">{t(paso.textKey)}</p>
          {paso.requiereRevisionClinica && <p className="revision">{t('sim.revision')}</p>}
        </div>
      </div>
      <div className="demo-controles">
        <button type="button" className="btn" onClick={() => setI(i - 1)} disabled={i === 0}>{t('demo.anterior')}</button>
        {ultimo
          ? <button type="button" className="btn primary" onClick={() => { registrar('naloxone_demo_completed'); onFin(true); }}>{textoFin ?? t('demo.terminar')}</button>
          : <button type="button" className="btn primary" onClick={() => setI(i + 1)}>{t('demo.siguiente')}</button>}
        <button type="button" className="btn" onClick={() => setI(0)}>{t('demo.repetir')}</button>
        <button type="button" className="btn ghost" onClick={() => onFin(false)}>{t('demo.omitir')}</button>
        <label className="toggle-inline">
          <input type="checkbox" checked={voz} onChange={(e) => {
            setVoz(e.target.checked);
            if (e.target.checked) registrar('accessibility_mode_enabled', { modo: 'narracion' });
          }} />
          {t('demo.narrar')}
        </label>
      </div>
    </section>
  );
}
