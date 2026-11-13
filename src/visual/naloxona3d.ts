// Adaptador para la demostración 3D de la naloxona. Todavía no hay modelos GLB del dispositivo, la cabeza ni la
// mano, así que no se carga nada: la interfaz usa la secuencia ilustrada. Cuando existan, se agregan sus URLs en
// ASSET_NALOXONA (content/recursos.ts) y aquí se carga three.js de forma diferida, solo si hay WebGL.
import type { NaloxoneVisualAsset } from '../sim/tipos';

export interface Escena3DNaloxona {
  /** Lleva la boquilla a la fosa nasal (con ajuste automático cuando está cerca). */
  acercarBoquilla(): void;
  presionarEmbolo(): void;
  reiniciar(): void;
  /** Detiene el dibujo cuando la escena no se ve. */
  pausar(pausada: boolean): void;
  destruir(): void;
}

export function hayModelos3D(asset: NaloxoneVisualAsset): boolean {
  return Boolean(asset.deviceModelUrl);
}

export function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Devuelve null mientras no haya modelos o WebGL: quien la llama muestra la secuencia ilustrada. */
export async function crearEscena3DNaloxona(_contenedor: HTMLElement, asset: NaloxoneVisualAsset): Promise<Escena3DNaloxona | null> {
  if (!hayModelos3D(asset) || !hayWebGL()) return null;
  // Pendiente (fase 3 o 4): import('three') diferido, cargar deviceModelUrl/headModelUrl/handModelUrl con
  // GLTFLoader + MeshoptDecoder, sin sombras en teléfonos y con requestAnimationFrame pausado fuera de vista.
  return null;
}
