# Publicar el simulador (enlace e iframe)

Hay tres formas de distribuirlo. Las tres salen del mismo código.

| Build | Comando | Resultado | Para qué |
|---|---|---|---|
| Sitio web | `npm run build:web` | `dist-web/` (unos 8 MB en 20 archivos) | Publicarlo con un enlace o dentro de otra página (iframe) |
| Simulador por pasos, un archivo | `npm run build:arbol` | `dist-arbol/arbol.html` (unos 10.4 MB, con la escena 3D y los modelos) | Compartir por correo o abrir con doble clic |
| Simulador clásico 3D, un archivo | `npm run build` | `dist/index.html` (unos 9.9 MB) | Compartir por correo o abrir con doble clic |

## Sitio web (`dist-web/`)

- **Páginas:**
  - `arbol.html`: el simulador por pasos con árbol de decisiones: menú, tutorial, cuatro escenarios, modo guiado o sin guía y escena 3D con iconos sobre la persona. Es el recomendado para la comunidad y para teléfonos.
  - `index.html`: el simulador clásico con escena 3D y acciones libres.
- **Tamaños.** Cada página baja solo lo suyo:
  - `arbol.html`: unos 122 KB comprimidos (React, el árbol y los textos) y las cuatro miniaturas de los escenarios (unos 25 KB cada una). La escena 3D (three.js, unos 184 KB comprimidos) y los modelos del caso se bajan al comenzar un escenario. Sin WebGL sigue funcionando con la lista de opciones.
  - `index.html`: unos 195 KB comprimidos de código (three.js).
  - Modelos 3D: unos 0.5 a 1 MB cada uno. El clásico baja solo los del caso escogido, cuando se escoge.
- **Rutas relativas:** funciona en cualquier carpeta del servidor, por ejemplo `https://www.salud.pr.gov/simulador/arbol.html`.
- **Requisitos del servidor:** es un sitio estático (HTML, JS, CSS, GLB) y no necesita base de datos ni servidor de aplicaciones. Sirve cualquier servidor web, Azure Static Web Apps, GitHub Pages o un bucket de S3.
- **Tipo de los modelos:** el servidor debe enviar los `.glb` como `model/gltf-binary`. Si no lo hace, la mayoría de los navegadores igual los aceptan.

### Encabezados recomendados del servidor

La página ya trae su política de seguridad (CSP) en una etiqueta `<meta>`. Hay una directiva que solo funciona como encabezado: `frame-ancestors`, que decide qué sitios pueden meter el simulador en un iframe.

```
Content-Security-Policy: frame-ancestors 'self' https://www.salud.pr.gov https://*.salud.pr.gov
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Qué permite la política de la página:**
- Scripts solo del mismo sitio. `'wasm-unsafe-eval'` existe solo para el descompresor de modelos (WebAssembly); no permite `eval` de JavaScript.
- Estilos en línea, por los atributos `style`.
- Fuentes de Google Fonts.
- Imágenes del mismo sitio y `data:`.
- Sin workers, sin `object` y sin formularios.

**Pendiente:** alojar las fuentes Poppins y Cinzel en el mismo sitio, para no depender de Google ni contactarlo. Las dos tienen licencia OFL.

### Insertarlo en otra página (iframe)

```html
<iframe
  src="https://www.salud.pr.gov/simulador/arbol.html"
  title="Simulador de respuesta a sobredosis"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  allow="fullscreen"
  loading="lazy"
  style="width:100%; min-height:720px; border:0">
</iframe>
```

**Atributos del `sandbox`:**
- `allow-scripts` es necesario: el simulador es una aplicación de JavaScript.
- `allow-same-origin` es necesario para cargar sus propios archivos. Los modelos del clásico se bajan del mismo servidor.
- `allow-popups` y `allow-popups-to-escape-sandbox` hacen que los enlaces de recursos (sitio web, correo, teléfono) abran bien fuera del iframe.
- No hace falta nada más: el simulador no pide cámara, micrófono, ubicación, almacenamiento ni formularios.

**Ajustar la altura sola.** Dentro de un iframe, `arbol.html` le avisa a la página que lo contiene la altura de su contenido. Solo envía un número; nunca lo que la persona escoge.

```html
<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.salud.pr.gov') return;            // el sitio donde está el simulador
    if (e.data && e.data.tipo === 'dspr-simulador-altura') {
      document.querySelector('iframe[title="Simulador de respuesta a sobredosis"]').style.height = e.data.altura + 'px';
    }
  });
</script>
```

## Analítica (desactivada)

`src/analitica.ts` es un adaptador que por omisión no envía nada. Para conectarlo a un servicio del Departamento:

```ts
import { configurarAnalitica } from './analitica';
configurarAnalitica({ enviar: (evento, datos) => navigator.sendBeacon('/metricas', JSON.stringify({ evento, ...datos })) });
```

- **Eventos:** `scenario_started`, `scenario_completed`, `scenario_repeated`, `naloxone_demo_started`, `naloxone_demo_completed`, `critical_action_missed` y `accessibility_mode_enabled`.
- **Datos:** solo identificadores como caso, perfil, desenlace o la acción que faltó. Nunca nombres, ubicación, información médica ni el texto de las decisiones.
- **Antes de activarlo:** si el servicio está en otro dominio, hay que agregarlo a `connect-src` en `vite.web.config.js`.

## Pruebas

| Comando | Qué revisa |
|---|---|
| `npm test` | Motor (calibración y propiedades), árbol, intérprete, validador e informe (Vitest) |
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Construye `dist-web/` y prueba con Playwright en Microsoft Edge |

**Qué cubre `test:e2e`:**
- axe-core (WCAG 2.2 AA) en menú, controles, tutorial, escenarios, modo, pasos con iconos, resumen de fase, demostración, práctica, conversación e informe.
- Menús: tutorial, controles, repaso de la naloxona y las cuatro tarjetas de escenario.
- Escena 3D: los iconos sobre la persona escogen la opción, no se enciman y quedan fuera del orden de Tab.
- Modo guiado (pista y explicación) y modo sin guía (la explicación llega en el resumen de la fase).
- El caso completo solo con teclado, sin perder el foco.
- Teléfono de 400 px, con botones de 44 px o más.
- Dentro de un iframe, sin WebGL, y con un modelo 3D que no carga.
- Movimiento reducido, idioma fijo en español de Puerto Rico (sin selector) y reinicio.
- Sin errores en la consola, con la política de seguridad activa.

Las pruebas usan el Edge instalado (`channel: 'msedge'`), así que no hace falta bajar los navegadores de Playwright.

### Pruebas manuales pendientes (lectores de pantalla)

Las herramientas automáticas no reemplazan estas pruebas. Hay que hacerlas antes de publicar.

| Lector | Plataforma | Qué revisar |
|---|---|---|
| NVDA | Windows + Edge o Firefox | Al cambiar de pantalla o de paso se lee el título. "Tu decisión" y "Lo que observas" se anuncian. Los grupos de opciones y el medidor de agitación se leen con su valor. La escena 3D se lee como una frase ("Escena 3D: lugar. Posición de la persona") y sus iconos no se anuncian: las opciones están en la lista. |
| VoiceOver | macOS + Safari; iOS + Safari | Lo mismo. Además, en iPhone: los gestos para pasar de opción en opción y activar botones, y que la narración de la demostración no choque con VoiceOver. |
| TalkBack | Android + Chrome | Lo mismo. Además: el tamaño de los botones y que el teclado en pantalla no tape las opciones. |

**Revisar también:** el contraste con alto contraste de Windows; el zoom al 200 % y al 400 %, que debe reacomodarse sin desplazamiento lateral; y la narración de la demostración con distintas voces en español.
