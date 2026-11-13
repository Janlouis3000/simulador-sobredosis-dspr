// Esquemas SVG de los pasos de la naloxona nasal. Son provisionales (hechos en código, sin imágenes externas)
// hasta tener ilustraciones o modelos 3D aprobados. Cada uno lleva su texto alternativo como título accesible.
import { useId } from 'react';
import type { ReactElement } from 'react';

const NAVY = '#1C2854', GOLD = '#e5bc44', SKY = '#8ACFF3', PIEL = '#c68e6a', GRIS = '#9aa3b5', ROJO = '#b42318';

/** Dispositivo de pie: boquilla arriba, cuerpo y émbolo abajo. (x, y) = punta de la boquilla. */
function Dispositivo({ x, y, rot = 0, embolo = 0 }: { x: number; y: number; rot?: number; embolo?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-5} y={0} width={10} height={26} rx={4} fill="#fff" stroke={NAVY} strokeWidth={2} />
      <rect x={-13} y={24} width={26} height={8} rx={3} fill="#fff" stroke={NAVY} strokeWidth={2} />
      <rect x={-9} y={32} width={18} height={30} rx={4} fill="#fff" stroke={NAVY} strokeWidth={2} />
      <rect x={-8} y={62 - embolo} width={16} height={10} rx={3} fill={GRIS} stroke={NAVY} strokeWidth={2} />
    </g>
  );
}

function Pulgar({ x, y }: { x: number; y: number }) {
  return <ellipse cx={x} cy={y} rx={11} ry={7} fill={PIEL} stroke={NAVY} strokeWidth={1.5} />;
}
function Dedos({ x, y }: { x: number; y: number }) {
  return (
    <g fill={PIEL} stroke={NAVY} strokeWidth={1.5}>
      <ellipse cx={x - 20} cy={y} rx={8} ry={13} />
      <ellipse cx={x + 20} cy={y} rx={8} ry={13} />
    </g>
  );
}
/** Perfil de una cabeza acostada boca arriba, mirando al techo; la nariz queda en (nx, ny). */
function Perfil({ inclinada = false }: { inclinada?: boolean }) {
  return (
    <g transform={inclinada ? 'rotate(-12 120 110)' : undefined}>
      <path d="M40 120 Q40 70 90 62 Q112 58 118 66 L126 52 Q130 46 134 54 L136 70 Q150 74 156 92 Q160 108 150 120 Z" fill={PIEL} stroke={NAVY} strokeWidth={2} />
      <path d="M40 120 Q30 98 44 78" fill="none" stroke={NAVY} strokeWidth={6} strokeLinecap="round" />
      <circle cx={104} cy={74} r={3} fill={NAVY} />
    </g>
  );
}
function Flecha({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#punta)" />;
}

const ESCENAS: Record<string, () => ReactElement> = {
  empaque: () => (
    <g>
      <rect x={50} y={60} width={100} height={60} rx={6} fill={SKY} stroke={NAVY} strokeWidth={2} />
      <path d="M50 60 L100 40 L150 60" fill="#fff" stroke={NAVY} strokeWidth={2} />
      <Dispositivo x={100} y={18} rot={-20} />
    </g>
  ),
  no_probar: () => (
    <g>
      <Dispositivo x={70} y={40} />
      <g fill={SKY} opacity={0.8}><circle cx={70} cy={28} r={8} /><circle cx={60} cy={18} r={7} /><circle cx={80} cy={16} r={6} /></g>
      <path d="M110 30 L170 110 M170 30 L110 110" stroke={ROJO} strokeWidth={9} strokeLinecap="round" />
    </g>
  ),
  pulgar: () => (<g><Dispositivo x={100} y={30} /><Pulgar x={100} y={108} /></g>),
  dedos: () => (<g><Dispositivo x={100} y={30} /><Dedos x={100} y={56} /><Pulgar x={100} y={108} /></g>),
  cabeza: () => (<g><Perfil inclinada /><Flecha d="M70 40 Q50 50 52 70" /></g>),
  introducir: () => (<g><Perfil /><Dispositivo x={130} y={58} rot={180} /><Dedos x={130} y={22} /></g>),
  presionar: () => (<g><Perfil /><Dispositivo x={130} y={58} rot={180} embolo={6} /><Dedos x={130} y={22} /><Flecha d="M170 10 L170 -2" /></g>),
  retirar: () => (<g><Perfil /><Dispositivo x={150} y={30} rot={200} /><Flecha d="M160 40 Q175 20 180 6" /></g>),
  continuar: () => (
    <g>
      <rect x={20} y={100} width={160} height={14} rx={7} fill={NAVY} opacity={0.15} />
      <circle cx={40} cy={92} r={12} fill={PIEL} stroke={NAVY} strokeWidth={2} />
      <rect x={52} y={84} width={110} height={18} rx={9} fill={SKY} stroke={NAVY} strokeWidth={2} />
      <path d="M40 66 q8 -8 16 0 M36 56 q12 -12 24 0" fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  nuevo: () => (
    <g>
      <circle cx={60} cy={70} r={34} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <path d="M60 70 L60 46 M60 70 L76 78" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
      <text x={60} y={124} textAnchor="middle" fontSize={16} fontWeight={700} fill={NAVY}>3 min</text>
      <rect x={118} y={48} width={64} height={70} rx={6} fill={SKY} stroke={NAVY} strokeWidth={2} />
      <Dispositivo x={150} y={36} />
    </g>
  ),
};

export function IlustracionNaloxona({ id, alt }: { id: string; alt: string }) {
  const tituloId = useId();
  const Escena = ESCENAS[id];
  return (
    <svg className="ilustracion" viewBox="0 -10 200 150" role="img" aria-labelledby={tituloId}>
      <title id={tituloId}>{alt}</title>
      <defs>
        <marker id="punta" viewBox="0 0 10 10" refX={5} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={GOLD} />
        </marker>
      </defs>
      <rect x={0} y={-10} width={200} height={150} rx={10} fill="#f1f3f7" />
      {Escena ? <Escena /> : null}
    </svg>
  );
}
