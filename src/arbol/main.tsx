// Punto de entrada de arbol.html. Antes de mostrar la aplicación, valida el árbol y su contenido: si hay errores,
// los muestra y no arranca (nodos sin destino, ramas inalcanzables, textos faltantes, etc.).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import './arbol.css';
import es from '../content/locales/es-PR.json';
import { ARBOL } from '../sim/arbol/arbol';
import { validateDecisionTree } from '../sim/arbol/validar';
import { CASOS_ARBOL } from '../sim/casos/casos';
import { App } from './App';
import { DIALOGOS } from './contexto';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz');

// Dentro de un iframe: avisa a la página que lo contiene la altura del contenido para que ajuste el marco
// (docs/despliegue.md). Solo envía un número; nada de lo que la persona escoge.
if (window.self !== window.top) {
  const avisar = () => window.parent.postMessage({ tipo: 'dspr-simulador-altura', altura: document.documentElement.scrollHeight }, '*');
  new ResizeObserver(avisar).observe(document.body);
}

const problemas = Object.values(CASOS_ARBOL).map((caso) =>
  validateDecisionTree(ARBOL, { caso, dialogos: DIALOGOS, textos: es }));
const errores = problemas.flatMap((p) => p.errores);
if (import.meta.env.DEV) for (const a of problemas.flatMap((p) => p.advertencias)) console.warn(`[árbol] ${a.codigo}: ${a.mensaje}`);

createRoot(raiz).render(
  <StrictMode>
    {errores.length
      ? (
        <div className="panel" role="alert">
          <h1>{(es as Record<string, string>)['app.error_contenido']}</h1>
          <ul>{errores.map((e, i) => <li key={i}><code>{e.codigo}</code> {e.mensaje}</li>)}</ul>
        </div>
      )
      : <App />}
  </StrictMode>,
);
