// Iconos de las acciones sobre la escena 3D. Dibujos propios y simples (SVG en código, sin imágenes externas).
import type { ReactElement } from 'react';
import type { Icono as TipoIcono } from '../../sim/tipos';

const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const DIBUJOS: Record<TipoIcono, ReactElement> = {
  // Mano abierta: tocar, frotar el pecho
  mano: <g {...T}><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6.5-6 6.5-2.6 0-4-1.2-5.2-3.4L4 14.2c-.6-1.2 1-2.3 2-1.2l2 2.2" /></g>,
  voz: <g {...T}><path d="M4 5h16v10H10l-4 4v-4H4z" /></g>,
  ojo: <g {...T}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></g>,
  // Aire que entra y sale: mirar o ayudar a respirar
  respirar: <g {...T}><path d="M3 9h10a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" /></g>,
  telefono: <g {...T}><path d="M6 3h3l1.5 5-2 1.5a12 12 0 0 0 6 6l1.5-2 5 1.5v3a2 2 0 0 1-2 2C10.5 20 4 13.500 4 5a2 2 0 0 1 2-2z" /></g>,
  // Spray nasal: boquilla, aletas, cuerpo y émbolo
  naloxona: <g {...T}><path d="M12 2v5M7 7h10M9 7v10a3 3 0 0 0 6 0V7M10 21h4" /></g>,
  corazon: <g {...T}><path d="M12 20s-7.5-4.6-7.500-10.2A4.3 4.3 0 0 1 12 7a4.300 4.300 0 0 1 7.500 2.800C19.500 15.400 12 20 12 20z" /><path d="M7.500 12.500h2.300l1.200-2.300 1.800 4.300 1.200-2h2.500" /></g>,
  // Girar de lado
  lado: <g {...T}><path d="M4 16h13a3 3 0 0 0 0-6h-2" /><path d="M8 12l-4 4 4 4" /><circle cx="19" cy="5.500" r="2" /></g>,
  reloj: <g {...T}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.500 2" /></g>,
  gota: <g {...T}><path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z" /></g>,
  // Subir la barbilla: abrir la vía aérea
  via: <g {...T}><circle cx="9" cy="9" r="4.500" /><path d="M9 13.500V20M15 18l4-4M19 18v-4h-4" /></g>,
};

export function Icono({ tipo }: { tipo: TipoIcono }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">{DIBUJOS[tipo]}</svg>;
}
