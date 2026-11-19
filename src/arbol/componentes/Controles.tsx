// Pantalla de controles: una tarjeta por forma de usar el simulador (ratón, pantalla táctil y teclado), cada una con
// su dibujo y sus gestos. Los dibujos son decorativos (aria-hidden): el texto de la tarjeta dice lo mismo.
import type { ReactElement } from 'react';
import { useT } from '../idioma';

const NAVY = '#1C2854', GOLD = '#e5bc44', SKY = '#8ACFF3', LINEA = '#c5cbd9', FONDO = '#eef1f6', PIEL = '#d9a57f';

/** Icono redondo de la escena (como los que salen sobre la persona). */
function Marca({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={21} fill="none" stroke={GOLD} strokeWidth={3} opacity={0.55} />
      <circle cx={x} cy={y} r={16} fill={NAVY} stroke="#fff" strokeWidth={3} />
      <path d={`M${x - 6} ${y + 1} h12 M${x} ${y - 5} v12`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}
/** Flecha doble (girar, acercar). */
function Doble({ d, m }: { d: string; m: string }) {
  return <path d={d} fill="none" stroke={GOLD} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" markerStart={`url(#${m})`} markerEnd={`url(#${m})`} />;
}

function Raton({ m }: { m: string }) {
  return (
    <g>
      <Marca x={52} y={50} />
      {/* Puntero */}
      <path d="M58 54 L58 82 L65 75 L70 87 L75 85 L70 73 L80 73 Z" fill="#fff" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Ratón: el botón izquierdo (clic) va en dorado */}
      <rect x={122} y={14} width={58} height={92} rx={29} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <path d="M151 14 H151 A29 29 0 0 0 122 43 V52 H151 Z" fill={GOLD} stroke={NAVY} strokeWidth={3} strokeLinejoin="round" />
      <path d="M122 52 H180 M151 14 V52" stroke={NAVY} strokeWidth={3} />
      <rect x={146} y={24} width={10} height={20} rx={5} fill={NAVY} />
      {/* Rueda: acercar */}
      <path d="M192 26 l-5 7 h10 Z M192 50 l-5 -7 h10 Z" fill={NAVY} />
      {/* Arrastrar: girar */}
      <Doble m={m} d="M22 104 Q52 92 82 104" />
    </g>
  );
}

function Tactil({ m }: { m: string }) {
  return (
    <g>
      {/* Teléfono */}
      <rect x={64} y={4} width={72} height={112} rx={12} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <rect x={71} y={14} width={58} height={86} rx={4} fill={FONDO} />
      <circle cx={100} cy={108} r={2.5} fill={NAVY} />
      <Marca x={100} y={48} />
      {/* Dedo que toca el icono */}
      <path d="M104 52 Q98 54 99 62 L104 96 Q106 104 116 102 L128 98 Q134 96 132 88 L122 58 Q118 50 110 51 Z" fill={PIEL} stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M103 58 Q108 54 114 56" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" />
      {/* Deslizar: girar */}
      <Doble m={m} d="M12 60 H48" />
      {/* Pellizcar: acercar */}
      <Doble m={m} d="M156 74 L186 44" />
      <circle cx={156} cy={74} r={5} fill={PIEL} stroke={NAVY} strokeWidth={2} />
      <circle cx={186} cy={44} r={5} fill={PIEL} stroke={NAVY} strokeWidth={2} />
    </g>
  );
}

function Tecla({ x, y, w, texto }: { x: number; y: number; w: number; texto?: string }) {
  return (
    <g>
      <rect x={x} y={y + 4} width={w} height={30} rx={6} fill={LINEA} />
      <rect x={x} y={y} width={w} height={30} rx={6} fill="#fff" stroke={NAVY} strokeWidth={2.5} />
      {texto && <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize={13} fontWeight={700} fill={NAVY} fontFamily="Poppins, sans-serif">{texto}</text>}
    </g>
  );
}
function Teclado() {
  return (
    <g>
      {/* Dos opciones; la que tiene el foco lleva el borde celeste */}
      <rect x={30} y={6} width={140} height={20} rx={5} fill="#fff" stroke={LINEA} strokeWidth={2} />
      <rect x={30} y={32} width={140} height={20} rx={5} fill="#fff" stroke={NAVY} strokeWidth={2} />
      <rect x={26} y={28} width={148} height={28} rx={8} fill="none" stroke={SKY} strokeWidth={4} />
      <path d="M40 16 h70 M40 42 h90" stroke={NAVY} strokeWidth={4} strokeLinecap="round" opacity={0.35} />
      <Tecla x={14} y={72} w={52} texto="Tab" />
      <Tecla x={74} y={72} w={62} texto="Enter" />
      <Tecla x={144} y={72} w={44} />
      <path d="M154 90 v5 h24 v-5" fill="none" stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

const TARJETAS: { id: string; Dibujo: (p: { m: string }) => ReactElement; gestos: string[] }[] = [
  { id: 'raton', Dibujo: Raton, gestos: ['clic', 'arrastrar', 'rueda'] },
  { id: 'tactil', Dibujo: Tactil, gestos: ['tocar', 'deslizar', 'pellizcar'] },
  { id: 'teclado', Dibujo: Teclado, gestos: ['tab', 'enter'] },
];

export function Controles() {
  const { t } = useT();
  return (
    <>
      <p className="lead">{t('controles.intro')}</p>
      <ul className="controles">
        {TARJETAS.map(({ id, Dibujo, gestos }) => (
          <li key={id} className="control">
            <svg viewBox="0 0 200 120" aria-hidden="true" focusable="false">
              <defs>
                <marker id={`ctl-punta-${id}`} viewBox="0 0 10 10" refX={6} refY={5} markerWidth={3.5} markerHeight={3.5} orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Z" fill={GOLD} />
                </marker>
              </defs>
              <Dibujo m={`ctl-punta-${id}`} />
            </svg>
            <h2>{t(`controles.${id}`)}</h2>
            <ul className="gestos">{gestos.map((g) => <li key={g}>{t(`controles.gesto.${g}`)}</li>)}</ul>
            <p>{t(`controles.${id}.texto`)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
