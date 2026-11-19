// Texto de cada decisión guardada en el registro de una partida: lo que se escogió y su explicación. Lo usan el
// resumen de cada fase y el informe final (en el modo sin guía, es ahí donde se ven las explicaciones).
import { nodo } from '../sim/interprete';
import type { Contexto } from '../sim/interprete';
import type { EntradaRegistro } from '../sim/tipos';
import type { Traductor } from './idioma';

export interface TextoDecision { opcion: string; explicacion: string }

export function textoDecision(ctx: Contexto, e: EntradaRegistro, t: Traductor['t']): TextoDecision {
  // La práctica de naloxona y la conversación guardan sus textos; las opciones del árbol guardan claves.
  if (e.texto) return { opcion: e.texto.opcion, explicacion: e.texto.fb };
  const op = nodo(ctx, e.nodo).options?.find((o) => o.id === e.opcion);
  return { opcion: t(op?.labelKey ?? e.feedbackKey ?? e.opcion), explicacion: e.feedbackKey ? t(e.feedbackKey) : '' };
}
