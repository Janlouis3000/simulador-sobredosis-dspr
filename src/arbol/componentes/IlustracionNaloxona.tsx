// Ilustraciones SVG de los pasos de la naloxona nasal, hechas en código (sin imágenes externas). El dispositivo
// tiene la forma del spray nasal de 4 mg: boquilla, cuerpo blanco con dos apoyos para los dedos y émbolo de color
// abajo. Es un dibujo genérico, sin marca ni logotipo. Cada ilustración lleva su texto alternativo como título.
import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

const NAVY = '#1C2854', GOLD = '#e5bc44', SKY = '#8ACFF3', PIEL = '#d9a57f', PIEL_SOMBRA = '#c68e6a', ROJO = '#b42318';
const EMBOLO = '#c2185b', CUERPO = '#ffffff', SOMBRA = '#dfe5f0', PELO = '#3b2a20';

type Mano = 'ninguna' | 'pulgar' | 'completa';

/**
 * Dispositivo de pie: (x, y) es la punta de la boquilla; el cuerpo queda hacia abajo. `presion` (0 a 1) sube el
 * émbolo. `mano` dibuja el pulgar en el émbolo y, si es 'completa', el índice y el dedo del corazón a cada lado
 * de la boquilla (protocolo DSPR, paso 5).
 */
function Dispositivo({ x, y, rot = 0, escala = 1, presion = 0, mano = 'ninguna' }: { x: number; y: number; rot?: number; escala?: number; presion?: number; mano?: Mano }) {
  const sube = 9 * presion;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${escala})`} strokeLinejoin="round">
      {/* Palma, detrás del dispositivo */}
      {mano === 'completa' && <path d="M-27 46 Q-32 70 -22 92 Q-10 108 12 104 Q30 98 29 74 L27 46 Z" fill={PIEL_SOMBRA} stroke={NAVY} strokeWidth={2} />}
      {/* Émbolo */}
      <rect x={-6.5} y={50 - sube} width={13} height={30} rx={4} fill={EMBOLO} stroke={NAVY} strokeWidth={2} />
      {/* Cuerpo: hombros para los dedos y dos patas, con el émbolo en el medio */}
      <path d="M-8 30 Q-25 30 -25 46 L-25 66 Q-25 71 -20 71 L-16 71 Q-11 71 -11 66 L-11 59 Q-11 52 -4 52 L4 52 Q11 52 11 59 L11 66 Q11 71 16 71 L20 71 Q25 71 25 66 L25 46 Q25 30 8 30 Z" fill={CUERPO} stroke={NAVY} strokeWidth={2.2} />
      <path d="M15 36 Q21 39 21 47 L21 66" fill="none" stroke={SOMBRA} strokeWidth={3} strokeLinecap="round" />
      <rect x={-17} y={40} width={34} height={6} rx={3} fill={EMBOLO} opacity={0.85} />
      {/* Boquilla */}
      <path d="M-6.5 32 L-6.5 7 Q-6.5 0 0 0 Q6.5 0 6.5 7 L6.5 32 Z" fill={CUERPO} stroke={NAVY} strokeWidth={2.2} />
      <path d="M2.5 6 L2.5 28" stroke={SOMBRA} strokeWidth={2.5} strokeLinecap="round" />
      {/* Índice y dedo del corazón, sobre los hombros del cuerpo */}
      {mano === 'completa' && (
        <g fill={PIEL} stroke={NAVY} strokeWidth={2}>
          <path d="M-29 56 L-29 26 Q-29 17 -21 17 Q-13 17 -13 26 L-13 44 Q-20 47 -29 56 Z" />
          <path d="M29 56 L29 26 Q29 17 21 17 Q13 17 13 26 L13 44 Q20 47 29 56 Z" />
          <path d="M-25 22 Q-21 19 -17 22 M17 22 Q21 19 25 22" fill="none" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
      {/* Pulgar, debajo del émbolo */}
      {mano !== 'ninguna' && (
        <g>
          <path d={`M-13 ${81 - sube} Q-14 ${74 - sube} -4 ${74 - sube} L12 ${74 - sube} Q22 ${76 - sube} 24 ${86 - sube} L26 104 L-2 104 Q-12 96 -13 ${81 - sube} Z`} fill={PIEL} stroke={NAVY} strokeWidth={2} />
          <path d={`M-7 ${79 - sube} Q0 ${76 - sube} 8 ${79 - sube}`} fill="none" stroke={NAVY} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

/** Empaque individual (blíster): bandeja con el dispositivo dentro. */
function Blister({ x, y, abierto = false, children }: { x: number; y: number; abierto?: boolean; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`} strokeLinejoin="round">
      <rect x={-38} y={0} width={76} height={104} rx={9} fill="#e9edf4" stroke={NAVY} strokeWidth={2} />
      <path d="M-16 12 Q-28 12 -28 26 L-28 84 Q-28 92 -18 92 L18 92 Q28 92 28 84 L28 26 Q28 12 16 12 Z" fill="#f7f9fc" stroke="#aab3c5" strokeWidth={1.5} />
      {children}
      {abierto
        ? <path d="M38 0 L10 0 Q30 8 38 30 Z" fill="#cfd6e3" stroke={NAVY} strokeWidth={2} />
        : <path d="M-38 9 Q-38 0 -29 0 L29 0 Q38 0 38 9" fill="none" stroke={NAVY} strokeWidth={2} />}
    </g>
  );
}

/**
 * Cabeza de perfil, acostada boca arriba: la coronilla a la izquierda y la cara hacia el techo. La entrada de la
 * fosa nasal queda cerca de (118, 46).
 */
function Perfil({ inclinada = false }: { inclinada?: boolean }) {
  return (
    <g transform={inclinada ? 'rotate(-14 150 110)' : undefined} strokeLinejoin="round">
      <path d="M190 126 L62 126 Q28 124 28 92 Q30 62 62 52 L88 48 Q94 47 98 50 L108 34 Q112 28 116 36 L118 46 Q122 51 126 49 Q131 47 132 52 Q133 56 129 57 Q134 59 138 55 Q146 51 150 59 Q153 67 156 77 Q162 86 190 88 Z" fill={PIEL} stroke={NAVY} strokeWidth={2.2} />
      {/* Pelo */}
      <path d="M64 51 Q30 60 28 92 Q28 116 50 124 Q40 104 46 84 Q52 64 76 58 Z" fill={PELO} stroke={NAVY} strokeWidth={2} />
      {/* Oreja, ojo cerrado y boca */}
      <path d="M84 84 Q76 78 78 90 Q80 98 88 94" fill={PIEL_SOMBRA} stroke={NAVY} strokeWidth={1.8} />
      <path d="M88 60 Q93 64 99 60" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" />
      <path d="M129 57 Q126 60 122 59" fill="none" stroke={NAVY} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Piso() {
  return <path d="M8 127 H192" stroke={NAVY} strokeWidth={3} strokeLinecap="round" opacity={0.25} />;
}
function Flecha({ d, m }: { d: string; m: string }) {
  return <path d={d} fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${m})`} />;
}
function Rocio({ x, y }: { x: number; y: number }) {
  return (
    <g fill={SKY} stroke={NAVY} strokeWidth={1.2} opacity={0.9}>
      <circle cx={x} cy={y} r={5} /><circle cx={x - 10} cy={y - 9} r={4} /><circle cx={x + 9} cy={y - 10} r={4.5} /><circle cx={x - 2} cy={y - 20} r={3.5} /><circle cx={x + 14} cy={y - 22} r={3} /><circle cx={x - 15} cy={y - 23} r={2.5} />
    </g>
  );
}

// El dispositivo entra a la fosa nasal desde el lado de la boca, inclinado hacia la coronilla.
const EN_NARIZ = { x: 117, y: 45, rot: 222, escala: 0.6 };

const ESCENAS: Record<string, (m: string) => ReactElement> = {
  empaque: (m) => (
    <g>
      <Blister x={78} y={16} abierto><Dispositivo x={0} y={20} escala={0.86} /></Blister>
      <Flecha m={m} d="M124 24 Q150 30 158 58" />
      <Dispositivo x={160} y={66} escala={0.74} rot={12} />
    </g>
  ),
  no_probar: () => (
    <g>
      <Dispositivo x={62} y={44} mano="completa" presion={1} escala={0.86} />
      <Rocio x={62} y={34} />
      <circle cx={146} cy={62} r={34} fill="#fff" stroke={ROJO} strokeWidth={7} />
      <path d="M123 39 L169 85" stroke={ROJO} strokeWidth={7} strokeLinecap="round" />
      <Dispositivo x={146} y={38} escala={0.6} />
    </g>
  ),
  pulgar: (m) => (<g><Dispositivo x={100} y={14} mano="pulgar" /><Flecha m={m} d="M150 116 Q146 100 130 96" /></g>),
  dedos: (m) => (<g><Dispositivo x={100} y={14} mano="completa" /><Flecha m={m} d="M40 20 Q56 22 66 36" /><Flecha m={m} d="M160 20 Q144 22 134 36" /></g>),
  cabeza: (m) => (<g><Piso /><Perfil inclinada /><Flecha m={m} d="M52 34 Q30 44 26 70" /></g>),
  introducir: (m) => (<g><Piso /><Perfil /><Dispositivo {...EN_NARIZ} mano="completa" /><Flecha m={m} d="M186 34 Q176 52 150 56" /></g>),
  presionar: (m) => (<g><Piso /><Perfil /><Dispositivo {...EN_NARIZ} mano="completa" presion={1} /><Flecha m={m} d="M190 2 L176 18" /></g>),
  retirar: (m) => (<g><Piso /><Perfil /><Dispositivo x={138} y={26} rot={222} escala={0.6} presion={1} /><Flecha m={m} d="M150 40 Q166 34 178 14" /></g>),
  continuar: () => (
    <g strokeLinejoin="round">
      <Piso />
      {/* Persona de lado, en posición de rescate: se vigila su respiración */}
      <path d="M58 124 Q54 100 76 96 L132 94 Q150 94 158 108 L170 124 Z" fill={SKY} stroke={NAVY} strokeWidth={2.2} />
      <path d="M118 124 L150 104 Q158 100 162 108 L170 124 Z" fill="#6f93c4" stroke={NAVY} strokeWidth={2.2} />
      <path d="M72 104 Q60 110 50 122" fill="none" stroke={PIEL} strokeWidth={11} strokeLinecap="round" />
      <path d="M72 104 Q60 110 50 122" fill="none" stroke={NAVY} strokeWidth={2} strokeLinecap="round" opacity={0.25} />
      <circle cx={44} cy={104} r={17} fill={PIEL} stroke={NAVY} strokeWidth={2.2} />
      <path d="M30 96 Q34 84 48 86 Q60 90 60 102 Q50 94 30 96 Z" fill={PELO} stroke={NAVY} strokeWidth={1.8} />
      <path d="M36 108 Q40 111 44 108" fill="none" stroke={NAVY} strokeWidth={1.8} strokeLinecap="round" />
      {/* Respiración */}
      <path d="M24 86 q-8 -8 0 -16 M14 92 q-14 -14 0 -28" fill="none" stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" />
      {/* Reloj: quedarse y vigilar */}
      <circle cx={158} cy={40} r={24} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <path d="M158 40 L158 24 M158 40 L170 46" stroke={NAVY} strokeWidth={3.5} strokeLinecap="round" />
    </g>
  ),
  nuevo: (m) => (
    <g>
      <circle cx={50} cy={58} r={32} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <path d="M50 58 L50 36 M50 58 L66 66" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
      <text x={50} y={116} textAnchor="middle" fontSize={17} fontWeight={700} fill={NAVY} fontFamily="Poppins, sans-serif">3 min</text>
      <Flecha m={m} d="M90 58 H112" />
      <Blister x={156} y={12}><Dispositivo x={0} y={20} escala={0.86} /></Blister>
    </g>
  ),
};

export function IlustracionNaloxona({ id, alt }: { id: string; alt: string }) {
  const tituloId = useId();
  const marcador = `punta-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const escena = ESCENAS[id];
  return (
    <svg className="ilustracion" viewBox="0 -10 200 150" role="img" aria-labelledby={tituloId}>
      <title id={tituloId}>{alt}</title>
      <defs>
        <marker id={marcador} viewBox="0 0 10 10" refX={5} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={GOLD} />
        </marker>
      </defs>
      <rect x={0} y={-10} width={200} height={150} rx={10} fill="#eef1f6" />
      {escena ? escena(marcador) : null}
    </svg>
  );
}
