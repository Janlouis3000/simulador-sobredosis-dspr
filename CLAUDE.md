# Simulador de Respuesta a Sobredosis · DSPR

Simulador educativo en español para adiestramiento comunitario. Lo desarrolla la División de Salud Pública para la Prevención de Sobredosis por Sustancias Psicoactivas del Departamento de Salud de Puerto Rico (DSPR). La persona usuaria encuentra a alguien con una sobredosis, toma decisiones libres (9-1-1, vía aérea, naloxona, respiraciones, RCP, posición de rescate) y ve cómo cambian los signos, el oxígeno y el desenlace.

## Estado actual (v3: fases 1, 2 y 3 completadas)
- Proyecto Vite con ES modules y Three.js r187 instalado por npm (sin CDN). `npm run build` genera `dist/index.html`: un solo archivo con JS, CSS, logos, los siete personajes que usan los casos y los cuatro escenarios GLB embebidos (vite-plugin-singlefile) para compartir sin servidor. Pesa unos 11.9 MB: la geometría de personajes y escenarios va comprimida con meshopt (`npm run comprimir`), y las texturas son WebP.
- `index.html`: marcado de las tres pantallas (inicio, simulación, resultado).
- `src/`:
  - `engine.js`: motor fisiológico puro, sin DOM. Es la fuente de verdad clínica del modelo. No cambió en la migración.
  - `escenarios.js`: planes de calibración (los mismos del `test.js` de la v2).
  - `engine.test.js`: pruebas de Vitest. Fijan los desenlaces exactos de la v2 y las reglas de abajo.
    - La calibración es una prueba de regresión contra la v2: comprueba que el motor siga dando los mismos resultados, no que el modelo sea clínicamente válido. Cada expectativa va con el nombre de su escenario (`EXPECTED`); falla si falta una, si sobra o si un nombre se repite.
    - También fija los eventos del mismo segundo en `advance()` y la regla de `outcome()` cuando la ambulancia llega con la persona en paro.
  - `advance()` se detiene al final del primer segundo con algún evento y devuelve los de ese segundo en orden fijo: a lo sumo uno que no termina el caso (prioridad `arrest`, `rosc`, `vomit`, `awake`) y después a lo sumo uno que lo termina (prioridad `ems`, `death`, `timeout`). Así la llegada de la ambulancia no se retrasa un paso cuando coincide con el vómito o el despertar. El árbol (`eventoPrincipal` en `interprete.ts`) y el clásico (`handleEvents` en `ui.js`) terminan el caso ahí, sin abrir el vómito ni la conversación. Con esto no cambió ningún valor de la calibración.
  - `outcome()`: si la ambulancia llegó y la persona sigue en paro, con `arrestNoCpr < 180` y `damage < 300` el desenlace es `sobrevive` (daño hasta 85) o `dano`. Es una abstracción para cerrar el caso, no una simulación de lo que hacen los paramédicos.
  - Vómito y broncoaspiración: el motor marca `vomitAt` y, si está de lado, `vomitHandled`; nunca marca `aspirated`. La broncoaspiración solo ocurre por una decisión de la persona usuaria (`openVomit` en `ui.js`, opción `vomito.seguir` del árbol: +28 de daño y −14 de oxígeno). Sin regla definida (pendiente de revisión clínica): vomitar boca arriba mientras nadie está (irse del lugar), en las corridas sin decisiones (calibración y propiedades), o cuando la ambulancia llega en ese mismo segundo. Tampoco se informa un vómito que coincida con el retorno del pulso (`rosc` tiene prioridad).
    - El episodio se desencadena cuando la persona pasa de no responder a responder con al menos una dosis que entró (`f > 0`, `lastEffectiveDose`); una dosis desperdiciada no lo desencadena por sí sola. Ocurre una sola vez por simulación.
    - Retraso de presentación (no clínico): `VOMIT_DELAY` = 5 s simulados, configurable por simulación con `s.vomitDelay`. Si el desencadenante llega antes de que pasen desde la última dosis, el aviso queda en `vomitPending` y sale en ese segundo, aunque la acción avance varios segundos de golpe (el reloj se detiene ahí). Un paro descarta el aviso pendiente. Ningún escenario de calibración cae en esa espera: sus valores no cambiaron.
  - Hallazgos de la auditoría, pendientes de decisión (sin cambiar todavía):
    - En "Hallazgo tardío", la segunda dosis puede quedar inaccesible durante la RCP: `rcp.naloxona` exige `sin_naloxona` y `decidir` solo se alcanza cuando ya respira.
    - Al descartar el primer dispositivo con otro disponible, `practicarNaloxona` vuelve sin avanzar el motor: se pierden del reloj los segundos de esa práctica (`sec`).
    - El modelo no representa que el efecto de la naloxona disminuye con el tiempo (por eso sigue en `it.todo` "volver a dormirse").
  - `engine.propiedades.test.js`: pruebas de propiedades, sin números fijos.
    - Determinismo, y que el resultado no dependa del tamaño de los bloques en que avanza la interfaz.
    - Que los signos queden dentro de rango con 300 planes al azar.
    - Que actuar antes o más tiempo nunca empeore el desenlace: naloxona, 9-1-1, respiraciones de rescate, RCP en paro, segunda dosis y posición de rescate.
    - "Peor" quiere decir: peor desenlace; si ambos mueren, morir antes; si no, más daño. La rutina `jugar` se detiene en la muerte, la ambulancia o el límite, como la interfaz (el motor solo no se detiene).
  - `scene.js`: escena 3D, poses por articulación (`POSES`), cianosis, utilería y cámaras. Las luces van multiplicadas por PI (`LI`) porque desde r155 son físicas.
    - Los personajes son `modelos/persona_*.glb` (MPFB, ver abajo), cargados con `import.meta.glob` y GLTFLoader. Cada caso pide un tipo de persona (`SET[id].persona`, la primera letra de la variante: `h` hombre adulto, `m` mujer adulta, `a` adolescente, `v` adulto mayor) y se escoge al azar una de sus variantes, para que ningún caso quede atado a un tono de piel. `?persona=a2` en la dirección fija una variante (capturas, talleres).
    - Hoy: casos 1 y 3 → `h1` a `h3`; caso 2 → `a1`, `a2` (16 años); caso 4 → `v1`, `v2` (72 años). Ningún caso pide `m`, así que `persona_m*.glb` se dejan fuera del build con un patrón negativo en el glob (siguen en `modelos/`).
    - Conducta al despertar (`EMOCIONES`, `ponerConducta`): es el equivalente web del Random Behavior System de Unity. Cada emoción (`state.emocion`: enojo, miedo, confusion, asco, gratitud, verguenza) es un contenedor de bloques con su porcentaje, y cada pocos segundos se escoge uno al azar. Los bloques son: quieta, mirar, negar, cabizbaja, mecer, asentir, apartar la cara, mano a la mejilla y mano a la boca.
    - La agitación (`state.agit`, de 0 a 1) acorta la espera, agranda los gestos y suma un temblor fino. Los giros se escriben como en `POSES` y se suman después del slerp. Los de la mano (`MANO`) se midieron a ojo con `persona_a1`.
    - El modelo empieza a cargar cuando se escoge el caso (`Scene3D.prepare`), en el clásico y en el árbol. Si ya cargó, `init` lo pone de una vez; si no, el maniquí de cápsulas de la v2 (`buildPerson`) ocupa su lugar mientras carga o si no carga (en el árbol, tapado por "Preparando la escena…").
    - `POSES` está escrito para articulaciones sin rotación de reposo y con brazos y piernas rectos. MakeHuman deja los brazos abiertos (pose A) y los codos doblados, así que `buildPersonGLB` corrige el reposo de brazos y piernas (`Cw`) y convierte: local = (reposo del padre)⁻¹ · pose · (reposo del hueso). Un modelo nuevo con los mismos nombres de huesos funciona sin tocar `POSES`.
    - `groundPoses` calcula la altura de la raíz en cada pose para que el punto más bajo del cuerpo toque el piso.
    - Ojos: claves de forma `eyeBlinkLeft`/`eyeBlinkRight` (en piel, cejas y pestañas). Si `cons` es 0-1 quedan entreabiertos (`EYE_REST`), a medio abrir en 2 y abiertos en 3. Al revisar las pupilas (`Scene3D.checkPupils`), el ojo derecho se abre 5 segundos.
    - Pupila: `pupilShader` agranda o achica el disco negro de la textura del ojo según `d.pupil` del motor (mm). Depende de la posición de los ojos en `brown_eye.png` de MakeHuman (`OJO`); si se cambia la textura del ojo hay que medirla de nuevo.
    - Vómito: charco con borde irregular y grumos (`vomitPuddle` en `ambiente.js`). Aparece junto a la boca y crece en un segundo.
    - Sombra de contacto bajo el cuerpo (`contactShadow`) y luz de entorno (`RoomEnvironment`) para reflejos y luz rebotada.
    - Cianosis: la piel se multiplica por un tinte gris azulado y un shader (`cyanosisShader`) mezcla labios y uñas hacia morado y enfría los dedos. Usa las máscaras del color de vértice (r = labios, g = uñas, b = falanges de los dedos).
    - Respiración: se escala el hueso `chest` en ancho y profundidad del cuerpo (`breathe`); el cuello y las clavículas se escalan al revés para no inflarse.
    - Rendimiento (medido con Playwright, noviembre de 2026):
      - Las luces (`luces`) se crean una vez con el renderer y pasan de un caso al siguiente. Antes cada caso creaba otra luz con sombra y su mapa de 2048 px (unos 33 MB de GPU) nunca se liberaba.
      - `Scene3D.pausar()` detiene el dibujo al salir del caso (`Escena3D` lo llama al desmontarse); `init` lo vuelve a empezar. Antes seguía dibujando en el menú.
      - Cejas y pestañas van con `forceSinglePass`, y ellas y los ojos no proyectan sombra. Antes recalculaban su programa de shader en cada cuadro.
      - `groundPoses` se calcula una vez por modelo (`sueloPorModelo`).
  - Escenarios: se usan los horneados en Blender (`modelos/escenario_<caso>.glb`, ver abajo). `ponerEscenario` los carga; sus materiales vienen negros con la luz horneada como emisión, así que el navegador solo les agrega reflejos. Un plano con `ShadowMaterial` muestra la sombra de la persona sobre el piso horneado. Si el GLB no está listo o no carga, se arma el escenario procedural de `ambiente.js`.
  - `ambiente.js`: escenarios procedurales de respaldo (`buildSet`), luces por caso (`ESCENARIOS`), sombra de contacto y vómito. Sus superficies se generan en el navegador con mapa de color, relieve y rugosidad.
  - `ui.js`: estado de la simulación, acciones, Narcan paso a paso, diálogos y resultado.
    - Al despertar (`openAwake`) hay una conversación de tres turnos para calmar a la persona, con un medidor de agitación. Termina en "se calma y se queda", "se queda de mala gana" o "se va" (agitación 100 desde el segundo turno), y aparece en el resultado como "Calmarlo/a al despertar". No toca el motor, salvo dar otra dosis o cancelar la ambulancia, que actúan como los botones de siempre.
  - `content.js`: textos de los casos, acciones, pasos de Narcan, datos de la División y `DESPERTAR`.
    - `DESPERTAR` tiene un perfil por caso (`CASE_INFO[id].despertar`): `nota` (adulto que usa sustancias), `joven` (adolescente) y `mayor` (adulto mayor). Cada perfil trae variantes de cómo despierta, escogidas al azar, cada una con su emoción: enojo porque "le quitaron la nota", miedo, confusión, asco, agradecimiento o vergüenza. Después vienen tres turnos de respuestas, con su efecto en la agitación y su explicación. Si se calma, da las gracias y su emoción pasa a gratitud.
    - `?emocion=asco` en la dirección fija la reacción (capturas, talleres), como `?persona=`.
    - Fuente del despertar con síntomas: hoja de datos y guía de inicio rápido de NARCAN en español (Emergent, 2025-2026). Las respuestas siguen prácticas generales de cuidado después de la naloxona y están pendientes de revisión.
  - `charts.js`: gráficas SVG. `util.js`: `$`, `fmt`, `esc`. `main.js`: punto de entrada. `styles.css`: estilos.
- **Simulador con árbol de decisiones (los cuatro casos).** Página aparte: `arbol.html` (`npm run dev` → /arbol.html; `npm run build:arbol` → `dist-arbol/arbol.html`, un solo archivo de unos 12.6 MB porque lleva la escena 3D y los modelos). El simulador clásico (`index.html`) no cambió.
  - **Flujo y escena (`src/arbol/App.tsx`):** menú (Jugar, Tutorial, Controles, Cómo usar la naloxona) → pregunta del tutorial (solo la primera vez) → tarjetas de los cuatro escenarios con miniatura → modo y perfil → simulación → informe.
    - El inicio tiene el formato del simulador clásico: título y botones a la izquierda, la tríada a la derecha (`Triada`) y debajo el bloque azul del Programa de Navegadores con los contactos (`Navegadores`, los dos en `componentes/Informe.tsx`). Usan las clases `hero`, `triad` y `division` de `styles.css` y los mismos textos del clásico (claves `triada.*` y `napro.*`).
    - Controles (`componentes/Controles.tsx`): una tarjeta ilustrada por forma de usarlo (ratón, pantalla táctil, teclado), con sus gestos. Los dibujos son decorativos; el texto dice lo mismo.
    - Demostración de la naloxona (`componentes/IlustracionNaloxona.tsx`): diez ilustraciones SVG con la forma del spray nasal de 4 mg (boquilla, cuerpo en U y émbolo de color), el empaque individual y la cabeza de perfil. Es un dibujo genérico, sin marca ni logotipo. El estilo de interacción (menú, escenarios, modo guiado, iconos sobre el cuerpo, resúmenes) sigue el de simuladores de respuesta a sobredosis que la persona a cargo compartió como referencia; el diseño, la marca, los modelos y los textos son del DSPR.
    - Modos (`Modo` en `tipos.ts`): `guiado` muestra una pista por paso y la explicación después de cada decisión; `sin_guia` no, y la explicación llega en el resumen de la fase y en el informe. Las pistas (`PISTA_DE` en `arbol.ts`) reutilizan los textos `retro.falta.*`: no agregan contenido clínico.
    - Fases (`FASES`, `FASE_DE`): evaluar, ayuda, apoyo, despertar. Al pasar a una fase posterior, `Simulacion.tsx` muestra el resumen de lo decidido. En un paro la naloxona se da durante la RCP, así que ese resumen se titula "Pedir ayuda" (`fase.ayuda_sola`).
    - `componentes/Escena3D.tsx` carga `scene.js` con import diferido y le pasa el estado del motor (`estadoEscena.ts`: pose, respiración, cianosis, vómito, teléfono, dosis, pupilas, emoción). Si no hay WebGL no muestra nada y queda la lista.
    - Carga sin maniquí a la vista: al tocar la tarjeta del caso, `precargarEscena` (`src/arbol/miniaturas.ts`) llama a `Scene3D.prepare`, que empieza a bajar three, el personaje y el escenario horneado.
      - `Scene3D.init` devuelve una promesa que se cumple cuando los dos modelos están en la escena (`'glb'`) o cuando alguno falló (`'respaldo'`). Si el personaje ya está precargado, entra sin pasar por el maniquí.
      - Mientras tanto, `Escena3D` tapa la escena con "Preparando la escena…" (`.cargando-escena`, `role="status"`), con la miniatura del caso desenfocada de fondo, y no muestra los iconos. La lista de opciones sigue disponible.
      - Se destapa con un fundido de 0.4 s, o a los 12 s (`ESPERA_MAXIMA_MS`) si la conexión es muy lenta. El maniquí y el cuarto procedural solo quedan a la vista si un modelo no carga.
      - Las texturas de los modelos precargados antes de crear el renderer reciben el filtro anisotrópico al crearlo (`sinNitidez`).
      - Pruebas: `e2e/carga.spec.ts` (precarga al escoger el caso, modelos lentos y modelos que no cargan).
    - Charco de vómito (`placeVomit` y `alturaApoyo` en `scene.js`): junto a la boca, a la altura de la superficie de apoyo en ese punto (un rayo hacia abajo contra el escenario, horneado o procedural; solo cuenta lo que está a menos de 6 cm del piso, así una mesa al lado no cuenta) más 2 mm para que no parpadee. Si el escenario horneado reemplaza al procedural al terminar de cargar, el charco a la vista se vuelve a apoyar (`reapoyarCharco`). Mientras se ve la mano dando la naloxona, el charco espera a que termine la animación. `Scene3D.charco()` es de solo lectura, para pruebas y diagnóstico.
    - Iconos (`.marca`): cada opción con `ancla` e `icono` (`VISUAL` en `arbol.ts`) sale como botón redondo sobre esa parte del cuerpo o ese objeto. `Scene3D.anclas()` da la posición en pantalla en cada cuadro; si dos caen juntos se separan 52 px. Repiten la lista de opciones, así que van con `aria-hidden` y fuera del orden de Tab. Mientras se ve una acción (RCP, respiraciones) se atenúan.
    - Naloxona a la vista (`Scene3D.darNaloxona`): al usarse una dosis, la cámara va de perfil a la cara y una mano con guante lleva el dispositivo a la fosa nasal, con el pulgar en el émbolo y dos dedos a los lados de la boquilla; la segunda dosis va en la otra fosa. De lado (posición de rescate) la cámara solo se acerca desde arriba. Dura 4.5 s; con movimiento reducido no se anima. `?nalox=0.62` deja la animación quieta en ese punto (capturas).
    - Presentación de la escena (`arbol.css`): ocupa la mayor parte del ancho (1.6 a 1), con sombra y una viñeta suave que no tapa los clics. Al pasar el puntero, cada icono muestra el texto de su opción (`data-etiqueta`).
    - Mano del rescatista: `modelos/mano_naloxona.glb`, una mano real con guante y manga, sacada de una persona MPFB (CC0) con `blender/generar_mano.py`. El script posa los dedos en el agarre del protocolo (busca con números la pose del pulgar que deja su yema en la base del émbolo), recorta la mano con el antebrazo y la exporta en el sistema de `cuerpoNaloxona` (punta de la boquilla en el origen hacia +z, antebrazo hacia +y). `--prev carpeta` guarda vistas de revisión. Necesita una persona sin comprimir. Mientras carga, o si no carga, `dispositivoEnMano` usa la mano simple de cápsulas.
    - Dispositivo y kit en 3D (`cuerpoNaloxona`, `narcan`, `cajaNaloxona` en `scene.js`; también los usa el clásico): el dispositivo tiene la forma del spray nasal de 4 mg (silueta extruida, boquilla, franja y émbolo rosados). En el piso van los dos dispositivos en su empaque individual y la caja del kit, con una etiqueta genérica dibujada en un lienzo ("NALOXONA · Spray nasal 4 mg · 2 dosis"): no se copia la marca ni el logotipo. El kit del piso va a 1.45 veces su tamaño (`ESCALA_KIT`) para que se distinga en la vista general; en la mano va a tamaño real.
    - El teléfono (`phone()` en `scene.js`) quedó del lado de la cámara, junto al hombro, para que su icono no caiga sobre la cabeza. `anclas()` saca de ahí y de los dispositivos las posiciones de "teléfono" y "kit".
    - Miniaturas: `blender/miniaturas_escenarios.py` renderiza cada `modelos/escenario_<caso>.glb` a `src/assets/escena_<caso>.webp` (960×600, el doble de lo que mide la tarjeta, para que se vea nítida en pantallas de alta densidad).
    - Segunda dosis: aparece en `decidir` y en `vigilar` cuando pasaron 3 minutos y la persona sigue sin responder (en los casos 1 y 2 basta esperar o vigilar para verla; con ella la adolescente del caso 2 despierta). No se cambió ninguna regla clínica para esto.
    - Higgsfield (generación de imagen a 3D) no se usa: el plan gratuito da 10 créditos (un modelo 3D cuesta 5 y el modo ilimitado no está disponible para la cuenta) y sus mallas no traen el rig, el parpadeo ni las máscaras de cianosis de las personas MPFB.
    - Nitidez: `nitida()` en `scene.js` pone filtro anisotrópico (hasta 8 muestras) a las texturas de los escenarios horneados y de las personas, para que el piso y las alfombras no se vean borrosos en ángulo rasante.
    - Calidad (`CALIDADES` en `scene.js`): `alta` por omisión; `?calidad=baja` en la dirección, para equipos lentos en talleres, dibuja con pixel ratio 1, sombras de 1024 px y filtro anisotrópico 2. No cambia nada clínico ni los iconos.
    - En `alta`, el límite de pixel ratio (2) y las sombras (2048 px) se quedaron como estaban.
      - Con pixel ratio 2 los bordes ya salen nítidos y la sombra bajo el cuerpo no se ve escalonada. Lo que se veía pixelado era la resolución y la compresión de las texturas.
      - Subirlo a 3 dibujaría 2.25 veces más píxeles en los teléfonos que lo tienen, sin arreglar las texturas.
  - TypeScript estricto (`tsconfig.json`), React 19 y Zod. `npm run typecheck`, `npm run lint` (ESLint) y `npm test` deben pasar.
  - `src/sim/`: lógica pura, sin DOM.
    - `tipos.ts`: tipos (DecisionNode, DecisionOption, CaseDefinition, ClinicalConfig, Partida, SimulationResult…).
    - `config/clinica.ts`: TODO número clínico configurable (intervalo de 2.ª dosis 180 s, umbrales de respiración, tiempos de cada acción, umbrales de la conversación). Cada valor dice su fuente y está marcado "requiere revisión clínica".
    - `arbol/arbol.ts`: un solo árbol para todos los casos. Los nodos `assessment` no los escoge la persona: el intérprete los resuelve con el motor. Los eventos del motor (paro, vómito, despertar, ambulancia, muerte) interrumpen y saltan a su nodo.
    - Evaluación de la respiración: la inicial ("¿respira normalmente?") usa 12 por minuto; después de la naloxona ("¿respira por su cuenta?") usa 8. Con 12 la ruta "de lado y vigilar" era inalcanzable (la persona despierta antes de llegar a 12). Requiere revisión clínica.
    - `interprete.ts`: transiciones puras (cada una devuelve una partida nueva). El motor (`engine.js`) sigue siendo la fuente de verdad clínica; `engine.d.ts` le da tipos.
    - `arbol/validar.ts` (`validateDecisionTree`) + `arbol/esquemas.ts` (Zod): detecta nodos sin destino, duplicados, inalcanzables o sin salida, evaluaciones incompletas, opciones sin retroalimentación, textos faltantes, diálogo inexistente, caso sin objetivos, terminar sin 9-1-1, dosis adicional sin criterio y género. `arbol/main.tsx` lo corre antes de arrancar y no muestra la app si hay errores.
    - `retro.ts`: informe (acciones críticas completadas, a reforzar, practicadas, tiempos, mensaje central). No es una puntuación.
    - `casos/casos.ts`: FENTANILO, PASTILLAS, XILAZINA y TARDIO. Solo configuración (motor, textos, diálogo, acciones críticas, `dosisExtraSiRespira`); el motor y sus valores no cambiaron. Las lecciones del informe salen de CASE_INFO (content.js).
    - Rama de paro (caso 4): si no respira o solo jadea, `llamar_paro` → llamar en altavoz y empezar la RCP de inmediato (AHA 2025); la naloxona se da durante la RCP (opción `rcp.naloxona`). Darla antes de la RCP es una opción incorrecta. Con la mejor respuesta el caso 4 termina en "posible daño cerebral", igual que la calibración del motor ("tardio: RCP inmediata").
    - Vía aérea antes de la naloxona (protocolo DSPR, paso 3 antes de los pasos 4 a 6): la ruta común es `llamar → operador → via_aerea → naloxona → apoyo`. Va después de llamar al 9-1-1 para no retrasar la activación del sistema de emergencias (AHA 2025, "Adult and Pediatric Special Circumstances of Resuscitation": la naloxona o esperar su efecto no deben retrasar la llamada ni la reanimación estándar; https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-and-pediatric-special-circumstances-of-resuscitation/).
      - `via_aerea` tiene `omitirSi: 'via_aerea_abierta'` (airwayOpen o de lado, como el motor): si ya está abierta no se repite. La respuesta incorrecta (`sin_abrir`) también sigue a la naloxona, sin demorar la dosis.
      - En la ruta de paro no hay pantalla de vía aérea: la RCP 30:2 la abre (`abrirViaAerea` y la acción `abrir_via_aerea`), porque las 2 respiraciones la necesitan.
      - Los textos del operador ahora dicen "ponla boca arriba y ábrele la vía aérea; después, dale la naloxona". `operador` y `via_aerea` están marcados para revisión clínica.
      - Las segundas dosis (`decidir`, `vigilar`) siempre ocurren con la vía aérea abierta o de lado (comprobado con partidas al azar).
    - **Pendiente de decisión clínica del DSPR (vía aérea en paro).** En estas ramas la naloxona se da sin haber abierto la vía aérea, porque añadir el paso interrumpiría la RCP:
      1. `rcp.compresiones_guiadas` (perfiles `basic_responder` y `unsure`): compresiones sin respiraciones; la vía aérea no se abre antes de `rcp.naloxona`.
      2. `rcp.naloxona` escogida antes de hacer un ciclo de `rcp.rcp_30_2` (por ejemplo, justo después de un paro).
      3. `llamar_paro.naloxona_primero` (opción incorrecta) y `via_aerea.sin_abrir` (opción incorrecta, a propósito).
    - Xilazina (caso 3): `dosisExtraSiRespira: false`. Respira por su cuenta y sigue dormido; no se ofrece otra dosis mientras respira de lado (lección del caso). Los demás casos sí la ofrecen si sigue sin responder tras 3 minutos (guía de NARCAN). Requiere revisión clínica.
    - "No llamar, para que nadie se meta en problemas" es una opción incorrecta en todos los casos (sale del texto del caso 2).
  - Perfiles: `cpr_trained` (predeterminado), `basic_responder`, `unsure`. Cambian las opciones (respiraciones/RCP 30:2 vs. seguir al operador/compresiones guiadas), lo que dice el operador y el informe; no cambian llamar al 9-1-1 ni dar naloxona. Las compresiones guiadas usan la RCP del motor (no hay modelo de solo compresiones): requiere revisión clínica.
  - Textos: fijos en español de Puerto Rico (`IDIOMA = 'es-PR'` en `src/i18n/i18n.ts`, `<html lang="es-PR">`). No hay selector de idioma ni en desarrollo ni en producción, y eso no depende de si hay otra traducción. Todas las claves están en `src/content/locales/es-PR.json`; `en-US.json` queda guardado pero no se carga. DESPERTAR y NARC_STEPS siguen en `content.js` (los comparte el clásico) y se validan con Zod.
  - Práctica de naloxona en modo sin guía (`PracticaNaloxona` en `Simulacion.tsx`): al escoger solo se confirma lo escogido ("Escogiste: …") y el foco pasa al botón para seguir; si el dispositivo se perdió se ve esa consecuencia. La explicación queda en el registro y sale en el resumen de la fase ("Pedir ayuda y naloxona", que ahora incluye `via_aerea`) y en el informe. En modo guiado se explica enseguida, como antes.
  - Informe: "Tus decisiones, en orden, con su explicación" (`<details>`) lista todo el registro con `textoDecision` (`src/arbol/registro.ts`), así ninguna explicación se pierde si el caso termina antes de un resumen de fase.
  - `src/content/recursos.ts`: contactos como datos (reemplaza DIVISION_HTML en el árbol) y los 10 pasos de la naloxona. `src/visual/naloxona3d.ts`: adaptador 3D vacío para la demostración paso a paso, hasta tener GLB del dispositivo, la cabeza y la mano (la dosis dentro de la simulación ya se ve en la escena, con `darNaloxona`).
  - Anillo de foco (`styles.css`, WCAG 1.4.11): azul marino sobre fondos claros (14:1), celeste solo dentro de las zonas azul marino y doble (blanco y marino) sobre la escena 3D. El celeste sobre blanco daba 1.7:1. Al abrir la página el foco no se mueve: en un iframe con `sandbox`, Edge 158 bloquea el foco sin acción de la persona y lo marca como error en la consola.
  - Interfaz (`src/arbol/`): HTML semántico, botones reales, foco al título de cada paso, `aria-live` para retroalimentación y observaciones, sin temporizadores, `prefers-reduced-motion`. La demostración tiene ilustraciones SVG provisionales hechas en código, narración opcional (voz del navegador, sin red) y Anterior/Siguiente/Repetir/Omitir.
  - Pruebas: `src/sim/interprete.test.ts` y `arbol/validar.test.ts` (transiciones, perfiles, naloxona perdida/parcial/nuevo dispositivo, 2.ª dosis, paro y vuelta a respirar, conversación calma/mala gana/se va, cancelar ambulancia, informe, los cuatro casos con los tres perfiles, RCP antes de la naloxona en paro, xilazina sin dosis extra, 800 partidas al azar que recorren todos los nodos y opciones). Pendiente (`it.todo`): volver a dormirse después de despertar; el motor no hace que la naloxona se pase.
  - Build web para enlace e iframe: `npm run build:web` → `dist-web/` (varios archivos, rutas relativas; arbol.html ≈ 122 KB gzip y baja three (≈ 184 KB gzip) y los GLB del caso al comenzar un escenario; index.html carga three y cada GLB solo al escoger el caso). Lleva la política de seguridad (CSP) en `<meta>` (vite.web.config.js): scripts solo propios + `'wasm-unsafe-eval'` para el descompresor meshopt (sin eso los modelos no cargan), Zod en modo `jitless` para no usar `new Function`. Dentro de un iframe, arbol.html envía su altura con `postMessage` (`dspr-simulador-altura`). Detalles, encabezados, `sandbox` del iframe y pruebas manuales pendientes con lectores de pantalla: `docs/despliegue.md`.
  - Analítica: `src/analitica.ts`, adaptador desactivado por omisión; solo eventos agregados sin datos identificables.
  - Pruebas de interfaz: `npm run test:e2e` (construye dist-web y corre Playwright con el Microsoft Edge instalado, `channel: 'msedge'`; no baja navegadores). `e2e/`: axe-core WCAG 2.2 AA en cada pantalla (menús incluidos), caso completo solo con teclado, menús, iconos de la escena 3D, modo guiado y sin guía, la misma pregunta de la práctica de naloxona en los dos modos (cuándo aparece la explicación y dónde queda el foco), dispositivo perdido en modo sin guía, 400 px, iframe, sin WebGL, GLB que no carga, movimiento reducido, idioma fijo (`lang="es-PR"` y sin selector), reinicio y sin errores de consola con la CSP. `entrar()` en `e2e/util.ts` va del menú a la simulación. Corre con 3 procesos a la vez (`workers: 3`): con más, Edge con WebGL se queda sin memoria en este equipo.
  - Fuentes de Google Fonts todavía externas; alojarlas en el sitio queda pendiente (OFL).
- `scripts/calibrar.js`: imprime la calibración con el mismo formato que el `test.js` de la v2.
- `scripts/comprimir.js` (`npm run comprimir`): comprime con meshopt la geometría de `modelos/persona_*.glb` y `escenario_*.glb`, en el lugar.
  - Usa glTF Transform y meshoptimizer, que son dependencias de desarrollo.
  - Conserva nombres, huesos, claves de forma, colores de vértice y texturas. No usa `prune()`, que borraría las máscaras de cianosis.
  - Salta los archivos que ya están comprimidos (para unirlos o comprimirlos de nuevo hay que exportarlos otra vez desde Blender: cuantizar dos veces corre las UV de la luz horneada). `npm run comprimir -- carpeta` trabaja en otra carpeta.
  - En los escenarios, antes de comprimir, une las mallas que comparten material (`flatten` + `join`): menos dibujos por cuadro. Son estáticas y `scene.js` no busca sus nodos por nombre. Las personas no se unen.
  - Hay que correrlo después de regenerar personas o escenarios en Blender. Personas: de 6.9 a 2.9 MB; escenarios (noviembre de 2026, con la unión de mallas): de 5.1 a 3.5 MB.
  - `scene.js` los descomprime con `MeshoptDecoder` de three, sin hilos, para no usar `Worker` ni URL `blob:`.
- `prototipo/simulador-sobredosis-dspr.html` es la v2 original, que queda como referencia. No tenía `<!doctype>` ni `<meta viewport>`: abría en modo de compatibilidad y en el teléfono se veía como de escritorio. La v3 ya tiene las dos cosas.
- `blender/generar_personajes_mpfb.py` genera los nueve personajes con MPFB 2 (MakeHuman para Blender) y los exporta a `modelos/persona_<id>.glb` (de 1.3 a 1.7 MB cada uno, texturas WebP; de 0.58 a 0.74 MB después de `npm run comprimir`). `--solo a1,v2` genera solo esos.
  - Texturas (`TEX`): piel en 2048, el tamaño original de MakeHuman; ropa en 1024; pelo, zapatos y ojos en 512.
    - La ropa tapa casi todo el cuerpo y de la piel solo se usa el 28 % (cara, cuello y manos). En 1024, con WebP 80, la cara se veía lisa, sin poros.
    - En capturas iguales, piel en 2048 con WebP 80 se ve tan nítida como 1024 con WebP 90. Cuesta de +55 a +75 KB por persona (+98 y +144 KB los adultos mayores, cuya piel tiene arrugas). La ropa en 2048 no se distingue (+170 KB).
    - Geometría, UV, huesos, claves de forma y máscaras de cianosis no cambian con esto.
  - Parámetros: `--calidad` (80) es la calidad WebP. Varias separadas por coma exportan un GLB por calidad, con sufijo `_q<calidad>`. `--tex-piel` y `--tex-ropa` cambian el lado de esas texturas para comparar.
  - Hoy solo se regeneran las siete que usan los casos. `persona_m1` y `persona_m2` quedaron con la piel de 1024 y no entran al build.
  - Edad en MPFB: 0.1875 = 11 años, 0.5 = 25 y 1.0 = 90. Adolescentes en 0.30 (≈16 años) y adultos mayores en 0.86 (≈72 años), con pieles "old" de MakeHuman y `canas` (pelo y cejas hacia gris).
  - Pelo de las adolescentes sin flequillo sobre los ojos: `bob01`/`bob02` los tapan y no se verían las pupilas.
  - Necesita la extensión MPFB y los paquetes CC0 "MakeHuman system assets" y "Faceunits 01" cargados en MPFB. Todo lo que produce es CC0.
  - Guarda en el color de vértice las zonas de cianosis: labios (grupo `lips`), uñas (`fingernails`, `toenails`) y dedos (pesos de los huesos de las falanges 2 y 3).
  - `VARIANTES` define cada persona: género, edad, peso, mezcla de ancestría, piel, pelo y ropa. La piel mezcla dos texturas de MakeHuman con el mismo mapa UV (clara y oscura) para lograr tonos intermedios.
  - Rig "Game engine" con los huesos del simulador renombrados (`HUESOS`): `pelvis`→`spine`, `spine_03`→`chest`, `upperarm_l`→`shL`, etc. Los demás (dedos, clavículas) conservan su nombre.
  - Ropa sin logos: varias prendas de MakeHuman traen su logo en la camisa. Los hombres usan prendas sin logo; a la camiseta de mujer se le borra en la textura (`LOGOS`). También se evitaron el pantalón muy corto y el top corto.
- `blender/generar_escenarios.py` arma los cuatro escenarios en Blender (cuarto y muebles simples con biseles y materiales procedurales, más muebles y enseres de la Asset Store; ver Unity abajo), hornea su luz con Cycles y los exporta a `modelos/escenario_<caso>.glb`.
  - Las posiciones se escriben en coordenadas de scene.js y `P()` las pasa a Blender. El sol apunta como la luz principal de scene.js para que la persona y el cuarto tengan la misma luz.
  - Hornea dos texturas por escenario (piso y resto): luz difusa (suavizada para quitar el ruido) × color. Borra antes las caras que no se ven (contra el piso o la pared).
  - Espejo, grifos, bombillas, pantalla de la lámpara y charco no se hornean (`dinamico`): conservan su material y brillan o reflejan en vivo.
  - Objetos de `modelos/objetos/` (los aportó la persona a cargo; GLB de Blender con textura pequeña) se colocan con `objeto_glb`: son dinámicos, pero están en la escena al hornear y dejan su sombra. Cada uno sigue el texto del caso en `content.js`:
    - Baño: la jeringuilla y el papelito doblado del texto.
    - Sala: pastillas sueltas y una cajetilla en la mesa.
    - Cuarto: un frasco y pastillas en la mesa de noche.
    - Callejón: una botella tirada junto al contenedor.
    - Sin jeringuilla en el callejón: el texto no la menciona y no se quiere sumar estigma a la escena de la calle.
  - `--texturas carpeta` guarda las texturas horneadas en PNG para revisarlas. `--muestras` controla el ruido del horneado.
  - Atlas horneados por escenario:
    - `--tam` (2048): paredes y muebles.
    - `--tam-piso` (3072): el piso. Los escenarios de `PISO_SIN_JUNTAS` (el callejón) usan `--tam`: su concreto liso no cambia a la vista y pesaba 134 KB más.
    - `--tam-cerca` (1024): un atlas propio para los objetos de `CERCA` (las alfombras), que quedan junto a la cabeza o debajo de la persona. El callejón no tiene.
  - `--calidad` (85) es la calidad WebP de exportación. Con varias separadas por coma (`85,90,95`) exporta un GLB por calidad desde el mismo horneado (sufijo `_q<calidad>`), para comparar.
  - Por qué esos valores (capturas iguales del baño, noviembre de 2026):
    - Con todo en 2048, las franjas de la alfombra se veían en bloques: le tocaban unos 270 texeles por metro. Las juntas del piso salían escalonadas en la vista de la cara.
    - Todo en 4096 lo arregla, pero el baño pasaba de 555 a 1090 KB y la memoria de texturas se cuadruplicaba.
    - Piso en 3072 y alfombra en 1024 (unos 850 texeles por metro) se ven casi igual que 4096 junto a la persona: 639 KB y unos 78 MB de memoria de texturas, frente a 44 MB antes.
    - WebP 90 o 95 no cambia nada visible en los escenarios (+150 y +460 KB).
    - 64 muestras bastan: el ruido solo queda en zonas tapadas por muebles, que no se ven.
- `blender/generar_personaje.py` y `modelos/persona.glb` son el personaje simple de la fase 2. El simulador ya no lo usa; queda como referencia.
- Unity: el proyecto `%USERPROFILE%\UnityProjects\SimuladorDSPR-assets` (Unity 6000.6.8f1, fuera de OneDrive) solo guarda los assets de la Asset Store de la persona a cargo, para que Blender los lea. El simulador sigue siendo web.
  - `generar_escenarios.py` lee de su carpeta `Assets` (`--unity`) los FBX y materiales de "House Interior - Free" (nappin) y "Appliances - SnapNSet Starter" (Alstra Infinite) con `mueble()`. Los escala a medidas reales (los de House Interior vienen a casi el doble, cada uno distinto), simplifica los muy densos antes de ponerlos (`max_tris`: la cama viene con 363 054 triángulos y queda en 20 000; el sofá, de 63 390 a 16 000) y los hornea con el cuarto: la textura de color se lee de su UV original y la luz va a una UV nueva.
  - Objetos aportados por la persona a cargo (`modelos/objetos/`): en el baño, rollo de papel de baño y destapador; en la sala del caso 2, un cubo de Rubik (`nitido=True` para que sus cuadros no se vean borrosos).
  - Hoy: baño → inodoro y dispensador de jabón (la persona a cargo pidió quitar la lavadora; el FBX sigue en el proyecto de Unity); sala → sofá y lámpara de pie; cuarto → cama con cabecera, gavetero y cafetera; callejón → ninguno (la persona a cargo pidió quitar la secadora). Los "Fan" de Appliances son campanas de cocina, no abanicos.
  - Baño: bañera con ducha (tubo, brazo y regadera), pegada a la pared de fondo y sin nada sobre el borde (la toalla amarilla que había se leía como una tabla de madera). El espejo empieza a 1.32 m del piso, por encima del remate del enchape. En `tina()` el fondo cabe dentro de las cuatro paredes: si llega hasta afuera, sus lados quedan encimados con las paredes y sale una franja con tramado negro y blanco.
  - No se usan: Random Behavior System y NPC AI Engine (Convai) son C#. Convai además manda la voz a la nube y necesita una clave, así que la persona a cargo decidió no usarlo. Su papel lo hacen `EMOCIONES` en `scene.js` y `DESPERTAR` en `content.js`. "1 toon teen" es estilo caricatura y no pega con las personas MPFB.
  - Para correr el script desde una copia en otra carpeta (rutas cortas), pasa `--objetos` con la carpeta de `modelos/objetos`.

## Reglas que no se cambian sin fuente
- **Protocolo DSPR.** Viene de la cápsula "Administración correcta de la naloxona", el afiche "Identifica, actúa y salva una vida" y el folleto de naloxona:
  1. Llamar al 9-1-1 y quedarse con la persona.
  2. Identificar la tríada: pupilas contraídas o puntiformes, depresión respiratoria y pérdida de conciencia. Otros signos: cianosis en labios y uñas, piel fría y cuerpo flojo.
  3. Poner a la persona boca arriba y abrir la vía aérea subiendo la barbilla. RCP si es necesaria.
  4. Abrir el empaque. No se prueba ni se bate el dispositivo.
  5. Pulgar en el émbolo; dedo índice y del corazón a cada lado de la boquilla.
  6. Introducir la boquilla en una fosa nasal hasta que los dedos rocen la nariz y presionar el émbolo rápido y firme. Toda la dosis va en una sola fosa nasal.
  7. Posición de rescate. Esperar 3 minutos antes de una segunda dosis. No dejar sola a la persona.
- **Ley 35 de Puerto Rico.** Protege a quien, de buena fe, administra naloxona (según el folleto DSPR).
- **AHA 2025.** Si la persona no respira o solo jadea, se hace RCP sin demorarla por la naloxona.
- **CDC (xilazina).** La naloxona no revierte la xilazina, pero se administra igual.
- Cualquier cambio de contenido clínico necesita una fuente citada en el commit y revisión de la persona a cargo del proyecto.

## Marca DSPR
- Colores: azul marino `#1C2854`, dorado `#e5bc44`, celeste `#8ACFF3`, gris `#cccccc`.
- Tipografía: Poppins para el texto. Trajan Pro para títulos; Cinzel es el respaldo web porque Trajan Pro tiene licencia de Adobe.
- Logos: `src/assets/logo_blanco.webp` para la banda azul y `logo_color.webp` para fondos claros. No se deforman ni se recolorean.
- Idioma: español formal de Puerto Rico, lenguaje sencillo para la comunidad, sin estigma. Se dice "persona que usa sustancias", no "adicto".

## Contactos (no inventar otros)
- Navegadores (NaPro): 787-765-2929, ext. 2253
- Educación, talleres y naloxona: 787-765-2929, ext. 3777 o 3682
- opioides@salud.pr.gov · www.salud.pr.gov/opioides
- Línea PAS (ASSMCA): 1-800-981-0023 o 988

## Cómo trabajar
- `npm install` una vez. Después:
  - `npm test`: Vitest debe pasar completo (buena respuesta = sobrevive; no hacer nada = muerte; tardío sin RCP = muerte). Si cambia un valor esperado de `engine.test.js`, el modelo clínico cambió: hace falta fuente y revisión. Que pase la calibración solo dice que el motor sigue igual a la v2; no es evidencia de validez clínica. Si falla una propiedad de `engine.propiedades.test.js`, el cambio contradice el protocolo (por ejemplo, dar naloxona antes saldría peor): no se ajusta la prueba sin revisión.
  - `npm run calibrar`: tabla de desenlaces para comparar a ojo.
  - `npm run dev`: servidor de desarrollo. `npm run build` → `dist/index.html`. `npm run preview`: sirve el build.
  - Modelos 3D, en este orden:
    1. `npm run escenarios` (o `npm run escenarios -- --solo fentanilo`): hornea en Blender y exporta a `modelos/` sin comprimir. Tarda varios minutos por escenario (Cycles en CPU).
    2. `npm run miniaturas`: renderiza las miniaturas desde esos GLB sin comprimir.
    3. `npm run comprimir`.
    - `npm run inventario` (solo lee): triángulos, vértices, peso, mallas, texturas y si están comprimidos.
    - `scripts/blender.js` busca Blender en la variable `BLENDER`, en el PATH o en `C:\Program Files\Blender Foundation` (la versión más nueva). Si el script de Python falla, termina con error.
- Probar en navegador con Playwright, incluido el ancho de teléfono (400 px), sin errores en la consola.

## Hoja de ruta (una fase por sesión)
1. ✅ **Migrar a Vite + Three.js moderno (ES modules).** Completada en la v3. `engine.js` queda como módulo puro con pruebas en Vitest. La interfaz y la escena se separan en módulos. Se mantiene un build que genere un solo HTML (vite-plugin-singlefile) para compartir sin servidor.
2. ✅ **Personaje GLB.** Completada en la v3. En la v2, sentada, las piernas atravesaban el piso y, de lado, el brazo de abajo también; se corrigieron esos ángulos de `POSES`. Lo que pedía la fase: cargar `modelos/persona.glb` con GLTFLoader. Mapear las poses de `scene.js` (`POSES`) a los huesos del GLB, que ya tienen los mismos nombres. La cianosis se hace cambiando el color del material "Piel" y de los labios. Hay que agregar ojos, párpados y labios como mallas hijas del hueso `head`.
3. ✅ **Personaje realista.** Completada en la v3: tres hombres, dos mujeres, dos adolescentes y dos adultos mayores, con tonos de piel de claro a oscuro. La geometría ya va comprimida con meshopt. Lo que pedía la fase: generar uno con MPFB2 (MakeHuman para Blender, salida CC0), con el rig "Game engine". Renombrar sus huesos a los del simulador y exportar a GLB. Hacer variantes de piel, cuerpo y ropa para representar la diversidad de Puerto Rico.
4. **Animación y sonido.** Respiración, ronquido y gorgoteo, jadeo agónico, compresiones con manos del rescatista, vómito, y despertar con abstinencia (ya hay conducta al azar y conversación al despertar; falta el sonido). Los sonidos arrancan solo después de que la persona toca un botón.
5. **Evaluación.** Prueba corta antes y después del simulador. Guardar decisiones, tiempos y desenlace para exportarlos a CSV o REDCap, sin datos que identifiquen a la persona.
6. **Opcional:** WebXR para visores de realidad virtual y modo proyector para talleres.

## Ejemplos de lo que se le puede pedir a Claude Code
- "Lee CLAUDE.md y ejecuta la fase 1. Corre las pruebas del motor antes y después."
- "Fase 2: conecta modelos/persona.glb y verifica las cuatro poses con capturas de Playwright."
- "Agrega un caso 5 de benzodiacepinas con alcohol: respuesta parcial a la naloxona. Calibra con `npm run calibrar` y agrega sus escenarios a `src/escenarios.js`."
