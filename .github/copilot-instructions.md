# Instrucciones para GitHub Copilot · Simulador de Respuesta a Sobredosis (DSPR)

Simulador educativo en español para adiestramiento comunitario, de la División de Salud Pública para la Prevención de Sobredosis por Sustancias Psicoactivas del Departamento de Salud de Puerto Rico (DSPR). Es para la página del Departamento: la información de salud no se cambia.

**Lee `CLAUDE.md` antes de proponer cambios.** Es la referencia completa del proyecto (estado, arquitectura, reglas clínicas, marca, contactos y hoja de ruta). Este archivo solo resume lo que no se puede pasar por alto.

## Reglas que no se rompen

- **Contenido clínico:** no cambies textos de salud, reglas del protocolo, contactos ni valores del motor sin una fuente citada y la revisión de la persona a cargo del proyecto. Si algo clínico parece incorrecto, señálalo y no lo cambies.
  - No toques por tu cuenta: `src/engine.js`, `src/sim/config/clinica.ts`, los textos de salud de `src/content.js` y de `src/content/locales/es-PR.json`, ni los valores esperados de `src/engine.test.js` y `src/engine.propiedades.test.js`.
  - Si una prueba del motor falla, el cambio contradice el modelo o el protocolo: no ajustes la prueba.
- **Protocolo DSPR, Ley 35, AHA 2025 y CDC (xilazina):** están en la sección "Reglas que no se cambian sin fuente" de `CLAUDE.md`.
- **Contactos:** solo los que aparecen en `CLAUDE.md`. No inventes teléfonos, correos ni enlaces.
- **Idioma:** español formal de Puerto Rico, lenguaje sencillo y sin estigma. Se dice "persona que usa sustancias", no "adicto".
- **Marca DSPR:** azul marino `#1C2854`, dorado `#e5bc44`, celeste `#8ACFF3`, gris `#cccccc`; Poppins para el texto y Cinzel para títulos. Los logos no se deforman ni se recolorean.
- **Accesibilidad (WCAG 2.2 AA):** HTML semántico, botones reales, foco al título de cada paso, objetivos táctiles de 44 px, `prefers-reduced-motion`. Los iconos de la escena 3D repiten la lista de opciones y van con `aria-hidden`.
- **Privacidad y seguridad:** sin datos que identifiquen a la persona, sin servicios externos nuevos y sin `eval` ni `new Function` (el sitio lleva política de seguridad de contenido).

## Dónde está cada cosa

- `index.html` + `src/*.js`: simulador clásico (motor `engine.js`, escena 3D `scene.js`, interfaz `ui.js`, textos `content.js`).
- `arbol.html` + `src/arbol/` (React y TypeScript) + `src/sim/` (lógica pura): simulador por pasos con árbol de decisiones.
  - `src/sim/arbol/arbol.ts`: el árbol. `src/sim/interprete.ts`: transiciones puras. `src/sim/casos/casos.ts`: los cuatro casos.
  - `src/content/locales/es-PR.json`: todos los textos de la interfaz del árbol.
- `modelos/`: personas y escenarios GLB. `blender/`: scripts que los generan.
- `e2e/`: pruebas de interfaz y accesibilidad (Playwright y axe-core).
- `docs/despliegue.md`: cómo publicarlo (enlace e iframe).

## Cómo trabajar

- `npm install` una vez; `npm run dev` para desarrollar (`/arbol.html` y `/index.html`).
- Antes de dar un cambio por terminado deben pasar: `npm test`, `npm run typecheck`, `npm run lint` y `npm run test:e2e`.
- TypeScript estricto. Los textos nuevos de la interfaz van en `es-PR.json`, no escritos dentro de los componentes.
- Prueba en el navegador, también a 400 px de ancho, y sin errores en la consola.
- La hoja de ruta está al final de `CLAUDE.md`. La fase siguiente es la 4 (animación y sonido).
