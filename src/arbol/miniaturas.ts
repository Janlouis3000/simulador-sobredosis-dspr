// Miniaturas de los escenarios, renderizadas en Blender (blender/miniaturas_escenarios.py). Salen en las tarjetas
// de los escenarios y de fondo en "Preparando la escena…" mientras cargan los modelos 3D.
import miniFentanilo from '../assets/escena_fentanilo.webp';
import miniPastillas from '../assets/escena_pastillas.webp';
import miniTardio from '../assets/escena_tardio.webp';
import miniXilazina from '../assets/escena_xilazina.webp';

/** Por identificador del motor (que coincide con el del caso). */
export const MINIATURAS: Record<string, string> = { fentanilo: miniFentanilo, pastillas: miniPastillas, xilazina: miniXilazina, tardio: miniTardio };

/**
 * Empieza a bajar la escena 3D (three.js) y los modelos del caso (personaje y escenario) apenas se escoge el caso,
 * para que estén listos al comenzar. Si algo falla aquí no pasa nada: Escena3D lo vuelve a intentar al entrar.
 */
export function precargarEscena(motor: string): void {
  import('../scene.js')
    .then((m) => (m.Scene3D as unknown as { prepare(id: string): void }).prepare(motor))
    .catch(() => {});
}
