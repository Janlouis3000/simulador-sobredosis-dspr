# Simulador de Respuesta a Sobredosis · DSPR

**Para verlo:** abre `dist/index.html` con doble clic. Ese es el archivo para compartir.
El `index.html` de la raíz es el código fuente y solo funciona con `npm run dev`.

1. Instala Claude Code en tu computadora. Las instrucciones están en docs.claude.com, en la sección de Claude Code.
2. Abre esta carpeta en una terminal y corre `npm install`.
3. Escribe `claude` y pídele: "Lee CLAUDE.md y ejecuta la fase 4".

**Simulador con árbol de decisiones (los cuatro casos):** abre `dist-arbol/arbol.html` con doble clic. Tiene menú (Jugar, Tutorial, Controles), cuatro escenarios con miniatura y dos modos: guiado (con pistas) y sin guía. Avanza paso a paso: en cada paso escoges qué hacer, con la lista de opciones o tocando los iconos sobre la persona en la escena 3D, y el cuerpo responde. Se ve la naloxona entrar en la fosa nasal, la segunda dosis si a los 3 minutos no responde, la RCP, la posición de rescate y el despertar. Incluye la demostración de la naloxona, tres perfiles de capacitación en RCP, la conversación al despertar, un resumen por fase y un informe final.

## Comandos
- `npm test`: pruebas del motor (Vitest).
- `npm run calibrar`: tabla de desenlaces del motor.
- `npm run dev`: servidor de desarrollo.
- `npm run build`: genera `dist/index.html`, un solo archivo para compartir que se abre con doble clic.
- `npm run build:arbol`: genera `dist-arbol/arbol.html`, el simulador con árbol de decisiones.
- `npm run build:web`: genera `dist-web/`, el sitio para publicar con un enlace o dentro de un iframe. Ver `docs/despliegue.md`.
- `npm run test:e2e`: pruebas de interfaz y accesibilidad con Playwright y axe-core (usa el Microsoft Edge instalado).
- `npm run typecheck` y `npm run lint`: revisan el código TypeScript y el estilo.
- `npm run comprimir`: comprime la geometría de las personas y los escenarios. Córrelo después de regenerarlos en Blender y antes de `npm run build`.

## Contenido
- `index.html` y `src/`: el simulador en módulos ES (motor, escena 3D, interfaz, contenido y gráficas).
- `prototipo/`: la v2 original, como referencia.
- `blender/generar_personajes_mpfb.py`: crea las nueve personas realistas con MPFB (MakeHuman para Blender): hombres y mujeres adultos, dos adolescentes y dos adultos mayores.
  - Comando: `blender --background --python blender/generar_personajes_mpfb.py -- --out modelos`
  - Solo algunas: agrega `--solo h2` o `--solo a1,v2`.
- `blender/generar_escenarios.py`: arma los cuatro escenarios y hornea su luz en Blender. Usa muebles y enseres de la Asset Store (House Interior y Appliances) desde el proyecto de Unity en `%USERPROFILE%\UnityProjects\SimuladorDSPR-assets`; otra carpeta se indica con `--unity`.
  - Comando: `blender --background --python blender/generar_escenarios.py -- --out modelos`
  - Uno solo y rápido: `--solo fentanilo --muestras 32 --tam 1024`.
- `modelos/escenario_*.glb`: los escenarios con luz horneada.
- `modelos/persona_*.glb`: las personas que usa el simulador. Se escoge una al azar según el caso. Para fijarla, agrega `?persona=h2` a la dirección (`h` adultos, `a` adolescentes, `v` adultos mayores).
- Al despertar con Narcan, la persona reacciona: se enoja porque le quitaron la nota, se asusta, siente asco, se avergüenza o da las gracias. Hay una conversación corta para calmarla, distinta en cada caso y con variantes al azar, y en 3D hace gestos según su emoción. Para fijar la reacción, agrega `?emocion=asco` (o `enojo`, `miedo`, `confusion`, `gratitud`, `verguenza`) a la dirección.
- `blender/generar_personaje.py` y `modelos/persona.glb`: el personaje simple de la fase 2, como referencia.
- `CLAUDE.md`: contexto, reglas clínicas, marca y hoja de ruta. Claude Code lo lee automáticamente.

## Cómo colaborar
- Clona el repositorio, corre `npm install` y luego `npm run dev`.
- Antes de proponer un cambio deben pasar `npm test`, `npm run typecheck`, `npm run lint` y `npm run test:e2e`.
- El contenido clínico (textos de salud, reglas del protocolo, contactos y valores del motor) no se cambia sin una fuente citada y la revisión de la persona a cargo del proyecto. Las reglas están en `CLAUDE.md`.
- Es una herramienta educativa en desarrollo: varias reglas están marcadas "requiere revisión clínica" y todavía no es una publicación oficial del Departamento de Salud.

## Materiales de terceros y licencias
- Este repositorio todavía no tiene una licencia para el código; la define el Departamento de Salud. Mientras no la tenga, no se concede permiso de reutilización.
- Logos y marca: son del Departamento de Salud de Puerto Rico. No se reutilizan fuera de este proyecto.
- Personas (`modelos/persona_*.glb`): generadas con MPFB y los recursos de MakeHuman, que son CC0.
- Muebles y enseres dentro de `modelos/escenario_*.glb`: vienen de los paquetes "House Interior - Free" (nappin) y "Appliances - SnapNSet Starter" (Alstra Infinite) de la Unity Asset Store y siguen bajo la licencia de esa tienda. No se extraen ni se reutilizan en otros proyectos.
- Objetos de `modelos/objetos/`: los aportó la persona a cargo del proyecto; su licencia está pendiente de documentar.
- Tipografías Poppins y Cinzel: licencia OFL. Las bibliotecas de código (three.js, React, Zod, Vite y otras) conservan sus propias licencias; están en `package.json`.

## Requisitos
- Node.js 18 o más reciente.
- Blender 4.2 o más reciente, solo para regenerar las personas y los escenarios. Para las personas, además:
  - la extensión MPFB;
  - los paquetes CC0 "MakeHuman system assets" y "Faceunits 01" cargados en MPFB.
