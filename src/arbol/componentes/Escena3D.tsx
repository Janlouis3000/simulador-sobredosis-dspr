// Escena 3D del simulador por pasos. Carga three.js y los modelos solo cuando hace falta (import diferido) y
// dibuja encima los iconos de las opciones del paso, anclados a partes del cuerpo y objetos.
//
// Accesibilidad: la escena es un apoyo visual. Los iconos repiten las opciones de la lista en HTML, que es la que
// usan el teclado y los lectores de pantalla; por eso los iconos van con aria-hidden y fuera del orden de Tab.
// Si no hay WebGL o la escena no carga, el componente no muestra nada y el simulador sigue igual con la lista.
import { useEffect, useRef, useState } from 'react';
import type { CaseId } from '../../engine';
import type { Ancla, Icono as TipoIcono } from '../../sim/tipos';
import type { EstadoEscena } from '../estadoEscena';
import { useT } from '../idioma';
import { Icono } from './Iconos';

interface Punto { x: number; y: number; visible: boolean }
interface Escena {
  init(contenedor: HTMLElement, caso: string): void;
  update(estado: Partial<EstadoEscena>): void;
  setView(vista: 'wide' | 'face', alInstante?: boolean): void;
  checkPupils(): void;
  anclas(): Record<string, Punto> | null;
  darNaloxona(fijo?: number): void;
}
// `?nalox=0.62` en la dirección deja la animación de la naloxona quieta en ese punto (capturas y talleres).
const naloxFija = Number(new URLSearchParams(location.search).get('nalox')) || undefined;

export interface Marca { id: string; ancla: Ancla; icono: TipoIcono; etiqueta: string; onClick: () => void }

interface Props {
  motor: CaseId;
  estado: EstadoEscena;
  marcas: Marca[];
  lugar: string;
  /** Descripción en texto de lo que se ve (para lectores de pantalla). */
  descripcion: string;
  /** Sube cada vez que se revisan las pupilas: acerca la cámara a la cara y abre un párpado. */
  pupilas: number;
  haciendo?: string;
}

/** Separación mínima entre dos iconos, en píxeles (44 px del icono + margen). */
const SEPARA = 52;
const movimientoReducido =() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function Escena3D({ motor, estado, marcas, lugar, descripcion, pupilas, haciendo }: Props) {
  const { t } = useT();
  const lienzo = useRef<HTMLDivElement>(null);
  const api = useRef<Escena | null>(null);
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const marcasRef = useRef(marcas);
  const estadoRef = useRef(estado);
  const [lista, setLista] = useState(false);
  const [fallo, setFallo] = useState(false);
  // Cámara escogida con los botones; revisar las pupilas después de eso acerca la cámara a la cara.
  const [camara, setCamara] = useState<{ v: 'wide' | 'face'; pupilas: number }>({ v: 'wide', pupilas: 0 });
  const vista = pupilas > camara.pupilas ? 'face' : camara.v;
  useEffect(() => { marcasRef.current = marcas; estadoRef.current = estado; });

  // Carga diferida de la escena (three.js + modelos del caso).
  useEffect(() => {
    let vivo = true;
    import('../../scene.js').then((m) => {
      if (!vivo || !lienzo.current) return;
      try {
        const escena = m.Scene3D as unknown as Escena;
        escena.init(lienzo.current, motor);
        lienzo.current.querySelector('canvas')?.setAttribute('aria-hidden', 'true');
        escena.update(estadoRef.current);
        api.current = escena;
        setLista(true);
      } catch {
        setFallo(true); // sin WebGL: el simulador sigue con la lista de opciones
      }
    }).catch(() => setFallo(true));
    return () => { vivo = false; api.current = null; };
  }, [motor]);

  // Estado del cuerpo. Una dosis nueva se ve: la mano lleva el dispositivo a la nariz.
  const dosisVistas = useRef(estado.dosesUsed);
  useEffect(() => {
    if (!lista) return;
    api.current?.update(estado);
    if (estado.dosesUsed > dosisVistas.current && !movimientoReducido()) api.current?.darNaloxona(naloxFija);
    dosisVistas.current = estado.dosesUsed;
  }, [estado, lista]);

  useEffect(() => {
    if (!lista || pupilas === 0) return;
    api.current?.setView('face');
    api.current?.checkPupils();
  }, [pupilas, lista]);

  // Los iconos siguen a su parte del cuerpo en cada cuadro (sin volver a dibujar React).
  useEffect(() => {
    if (!lista) return;
    let id = 0;
    const paso = () => {
      const a = api.current?.anclas();
      if (a) {
        const ancho = lienzo.current?.clientWidth ?? 0, alto = lienzo.current?.clientHeight ?? 0;
        const puestas: { x: number; y: number }[] = [];
        for (const m of marcasRef.current) {
          const el = botones.current.get(m.id), p = a[m.ancla];
          if (!el || !p) continue;
          // Dos opciones en el mismo sitio (o en sitios que la cámara junta, como ojos y boca): una al lado de la otra.
          let x = p.x, y = p.y;
          for (let n = 0; n < 6 && puestas.some((q) => Math.abs(q.x - x) < SEPARA && Math.abs(q.y - y) < SEPARA); n++) x += SEPARA;
          if (ancho && x > ancho - 26) { x = p.x; y += SEPARA; }
          x = Math.min(Math.max(x, 26), Math.max(26, ancho - 26));
          y = Math.min(Math.max(y, 26), Math.max(26, alto - 26));
          puestas.push({ x, y });
          el.style.transform = `translate(${Math.round(x - 22)}px, ${Math.round(y - 22)}px)`;
          el.style.visibility = p.visible ? 'visible' : 'hidden';
        }
      }
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [lista]);

  if (fallo) return null;
  const ver = (v: 'wide' | 'face') => { api.current?.setView(v); setCamara({ v, pupilas }); };
  return (
    <div className={haciendo ? 'escena3d haciendo' : 'escena3d'}>
      <div className="lienzo" ref={lienzo} />
      <p className="solo-lector">{descripcion}</p>
      <span className="chip lugar">{lugar}</span>
      {haciendo && <span className="chip haciendo">{haciendo}</span>}
      <div className="camaras">
        <button type="button" aria-pressed={vista === 'wide'} onClick={() => ver('wide')}>{t('escena.vista_general')}</button>
        <button type="button" aria-pressed={vista === 'face'} onClick={() => ver('face')}>{t('escena.cara')}</button>
      </div>
      {lista && marcas.map((m) => (
        <button
          key={m.id} type="button" className="marca" aria-hidden="true" tabIndex={-1} title={m.etiqueta}
          ref={(el) => { if (el) botones.current.set(m.id, el); else botones.current.delete(m.id); }}
          onClick={m.onClick}
        >
          <Icono tipo={m.icono} />
        </button>
      ))}
    </div>
  );
}
