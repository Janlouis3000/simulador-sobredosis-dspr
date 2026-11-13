// Contenido educativo: casos, acciones, pasos de Narcan y datos de la División.
const CASE_INFO = {
  fentanilo: {
    tag: 'Caso 1', title: 'Fentanilo', short: 'Tu primo no responde en el piso del baño.', place: 'Baño · Bayamón', despertar: 'nota',
    intro: 'Llegas a casa de tu primo y lo encuentras tirado en el piso del baño. No contesta cuando lo llamas. Cerca hay una jeringuilla y un papelito doblado.',
    lessons: [
      'El fentanilo es muy potente: puede hacer falta más de una dosis de naloxona. Espera 3 minutos antes de dar la segunda.',
      'Mientras la naloxona hace efecto, abrir la vía aérea y dar respiraciones de rescate es lo que lleva oxígeno al cerebro.',
      'Cuando despierte puede sentirse mal y querer irse. No la dejes sola: la naloxona dura de 30 a 90 minutos y el fentanilo puede durar más.'
    ]
  },
  // Caso 2: adolescente. El motor no cambia (mismos valores de "pastillas"); cambian la persona y el texto.
  // Fuentes: DEA, campaña "One Pill Can Kill" (pastillas falsas con fentanilo); hoja de datos de NARCAN en español
  // (venta sin receta, sin límite de edad ni identificación). Pendiente de revisión de la persona a cargo.
  pastillas: {
    tag: 'Caso 2', title: 'Pastilla falsa', short: 'Una joven de 16 años se tomó una pastilla en una fiesta.', place: 'Sala · fiesta en Carolina', despertar: 'joven',
    intro: 'Celebras en tu casa el cumpleaños 16 de tu hija. Sus amigos te buscan asustados: Valeria, una compañera de la escuela, se tomó una pastilla que alguien le vendió como "Percocet". Está en el piso de la sala, ronca muy fuerte y no se despierta cuando la llamas. Sus amigos te piden que no llames a nadie.',
    lessons: [
      'Las pastillas que se compran en la calle o por redes sociales pueden tener fentanilo, aunque parezcan de farmacia. En una persona joven que no usa opioides, una sola puede causar una sobredosis.',
      'Si ves la tríada, da naloxona aunque no sepas qué tomó. Si no era una sobredosis por opioides, la naloxona no le hace daño.',
      'Roncar fuerte o hacer ruido de gárgara no es dormir: la vía aérea está bloqueada y la respiración está fallando.',
      'Aunque te pidan que no llames, llama al 9-1-1: su vida va primero. El Narcan se compra en la farmacia sin receta, sin límite de edad y sin identificación.'
    ]
  },
  xilazina: {
    tag: 'Caso 3', title: 'Xilazina + fentanilo', short: 'Un hombre inconsciente con heridas en las piernas.', place: 'Callejón · Santurce', despertar: 'nota',
    intro: 'Camino al trabajo ves a un hombre tirado contra una pared. No responde. Tiene heridas abiertas en las piernas, algo que se ve cuando hay xilazina ("anestesia de caballo") mezclada con fentanilo.',
    lessons: [
      'La naloxona no revierte la xilazina, pero hay que darla igual: casi siempre viene mezclada con fentanilo. En Puerto Rico se usan muchas sustancias a la vez.',
      'La persona puede volver a respirar bien y seguir dormida. No busques más dosis: ponla en posición de rescate, vigila su respiración y espera la ambulancia.',
      'Las heridas por xilazina necesitan atención médica. Díselo a los paramédicos.'
    ]
  },
  // Caso 4: adulto mayor con pastillas recetadas. El motor no cambia (mismos valores de "tardio", en paro).
  // Fuentes: hoja de datos de NARCAN en español (la mayoría de las emergencias por opioides ocurren en el hogar;
  // sobredosis por analgésicos recetados); FDA, advertencia de recuadro de 2016 sobre opioides con benzodiacepinas;
  // CDC, guía de 2022 para recetar opioides (ofrecer naloxona a pacientes con más riesgo). Pendiente de revisión.
  tardio: {
    tag: 'Caso 4', title: 'Adulto mayor', short: 'Don Ramón, de 72 años, tomó de más sus pastillas para el dolor.', place: 'Cuarto · Ponce', despertar: 'mayor',
    intro: 'Don Ramón, tu vecino de 72 años, vive solo y toma pastillas recetadas para el dolor. Su hija no ha podido comunicarse con él desde la mañana. Entras con ella y lo encuentran en el piso del cuarto. En la mesa de noche hay un frasco abierto y pastillas regadas. Tiene los labios morados y cada tanto hace un ruido corto, como un jadeo.',
    lessons: [
      'Jadear de vez en cuando no es respirar. Si no respira o solo jadea, empieza la RCP de inmediato.',
      'En un paro por sobredosis, la RCP con respiraciones mantiene vivo el cerebro mientras la naloxona hace efecto y llega la ambulancia.',
      'Si hay otra persona, que llame al 9-1-1 y busque el Narcan mientras tú sigues con las compresiones.',
      'En personas mayores, la sobredosis suele ser un accidente: una pastilla de más porque el dolor no se va, confundirse con las dosis, o mezclar el opioide con pastillas para dormir o para los nervios, o con alcohol. Si en la casa hay opioides recetados, tengan Narcan a la mano. Guarda el frasco para los paramédicos.'
    ]
  }
};

const DIVISION_HTML = `
  <div class="a">
    <span class="eyebrow" style="color:#8ACFF3">Enlace a tratamiento</span>
    <h2>Programa de Navegadores (NaPro)</h2>
    <p>El Programa de Navegadores para el Manejo de Casos y Referido a Tratamiento facilita el enlace a tratamiento y servicios de apoyo para:</p>
    <ul>
      <li>Personas con trastornos por uso de sustancias (SUD)</li>
      <li>Personas que usan sustancias (PWUD)</li>
      <li>Sobrevivientes de sobredosis</li>
      <li>Población con mayor riesgo de sobredosis</li>
    </ul>
  </div>
  <div class="b">
    <div class="contact"><span>Navegadores (NaPro)</span><b>787-765-2929, ext. 2253</b></div>
    <div class="contact"><span>Educación, talleres y naloxona</span><b>787-765-2929, ext. 3777 o 3682</b></div>
    <div class="contact"><span>Correo electrónico</span><b>opioides@salud.pr.gov</b></div>
    <div class="contact"><span>Más información</span><b>www.salud.pr.gov/opioides</b></div>
    <div class="contact"><span>Línea PAS (ASSMCA), 24/7</span><b>1-800-981-0023 o 988</b></div>
  </div>`;

const ACTIONS = [
  { group: 'Identificar', items: [
    { id: 'resp', label: 'Llamarla fuerte y frotarle el pecho', hint: '10 s' },
    { id: 'pupils', label: 'Mirarle las pupilas', hint: '5 s' },
    { id: 'breath', label: 'Mirar si respira', hint: 'Mira el pecho 10 s' },
  ]},
  { group: 'Pedir ayuda', items: [
    { id: 'call', label: 'Llamar al 9-1-1', hint: 'En altavoz', key: true },
  ]},
  { group: 'Ayudar', items: [
    { id: 'airway', label: 'Abrir las vías aéreas', hint: 'Boca arriba, subir la barbilla' },
    { id: 'nalox', label: 'Darle Narcan', hint: '4 mg en una fosa nasal', key: true },
    { id: 'breaths', label: 'Respiraciones de rescate', hint: '1 cada 5 s · 1 min' },
    { id: 'cpr', label: 'RCP', hint: '30 compresiones y 2 respiraciones · 2 min' },
    { id: 'lado', label: 'Posición de rescate', hint: 'De lado, rodilla doblada' },
    { id: 'observe', label: 'Quedarte y vigilarla', hint: '1 min' },
  ]},
  { group: 'Otras cosas que la gente hace', items: [
    { id: 'water', label: 'Echarle agua fría o meterla en la ducha' },
    { id: 'sleep', label: 'Dejar que "duerma la nota"' },
    { id: 'leave', label: 'Irte del lugar' },
  ]},
];
const DOING = { breaths: 'Dando respiraciones de rescate', cpr: 'Haciendo RCP', none: '' };

const NARC_STEPS = [
  { q: 'Sacas el dispositivo del empaque. ¿Cómo lo sostienes?', o: [
    { t: 'Pulgar en el émbolo; dedo índice y del corazón a cada lado de la boquilla.', ok: true, fb: 'Así se sostiene: los dedos a cada lado de la boquilla y el pulgar listo para presionar.' },
    { t: 'Con el pulgar en la boquilla y los dedos en el émbolo.', sec: 5, fb: 'Al revés. El pulgar va en el émbolo (la parte que se presiona) y los dedos a cada lado de la boquilla.' },
  ]},
  { q: 'Antes de usarlo, ¿qué haces?', o: [
    { t: 'Nada: viene listo para usarse.', ok: true, fb: 'Correcto. No hay que probarlo ni batirlo.' },
    { t: 'Lo pruebas apretándolo una vez al aire.', wasted: true, fb: 'Cada dispositivo tiene una sola dosis. Al probarlo, la perdiste.' },
    { t: 'Lo bates como un aerosol.', sec: 10, fb: 'No hace falta batirlo. Perdiste unos segundos.' },
  ]},
  { q: '¿Cómo se lo administras?', o: [
    { t: 'Introduzco la boquilla en una fosa nasal hasta que mis dedos rocen la nariz y presiono el émbolo rápido y firme.', ok: true, fb: 'Correcto. Toda la dosis va en una sola fosa nasal.' },
    { t: 'Rocío un poco en cada fosa nasal.', f: 0.6, fb: 'No es necesario usar las dos fosas nasales. Al dividirla, parte de la dosis se pierde.' },
    { t: 'Lo pongo en la entrada de la nariz y presiono despacio.', f: 0.6, fb: 'La boquilla debe entrar hasta que los dedos rocen la nariz, y el émbolo se presiona rápido y firme.' },
  ]},
];

// ---------- Despertar y conversación para calmar ----------
// Al despertar con naloxona, la persona puede tener síntomas de abstinencia: temblor, sudor, náuseas, vómitos y
// enojo. Son esperables (hoja de datos de NARCAN en español: "algunas personas pueden experimentar síntomas al
// despertarse"). La guía de inicio rápido de NARCAN pide quedarse a su lado hasta que llegue la ambulancia, aunque
// despierte, y dar otra dosis solo si vuelve a tener mucho sueño.
// Las respuestas siguen prácticas generales de cuidado después de la naloxona: hablar bajo y despacio, decir qué
// pasó, no regañar ni sujetar, ofrecer algo concreto, explicar el riesgo de quedarse sola o usar otra vez.
// Pendiente de revisión de la persona a cargo del proyecto.
//
// Cada caso tiene un perfil (CASE_INFO[id].despertar). Al despertar se escoge al azar una de sus variantes
// (cómo despierta, qué dice y su emoción) y siguen tres turnos. La emoción (enojo, miedo, confusion, asco, gratitud
// o verguenza) escoge los gestos de la escena 3D (CONDUCTAS en scene.js); si se calma, pasa a gratitud.
// Cada respuesta tiene:
//   d: cuánto sube o baja la agitación (0 a 100); ok: 'ok', 'mid' o 'no' (si es buena práctica); fb: explicación.
//   accion (opcional): 'dosis' (otra dosis de Narcan), 'llamar' (9-1-1), 'irse' (se va) o 'cancelar' (cancela la ambulancia).
// En cada turno, la persona dice "alta" si la agitación va en 60 o más, y "baja" si no.
// Si la agitación llega a 100 desde el segundo turno, se va (una sola mala respuesta no basta). Al final de los
// tres turnos se queda: tranquila si la agitación quedó en 35 o menos, de mala gana si no.
const DOSIS_EXTRA = { t: 'Darle otra dosis de Narcan por si acaso.', accion: 'dosis', d: 30, ok: 'no',
  fb: 'Ya respira bien: otra dosis no hace falta y empeora la abstinencia (vómitos, temblores y más enojo). Se da otra solo si vuelve a tener mucho sueño.' };
const LLAMAR = { t: 'Llamar al 9-1-1 en altavoz, sin dejar de hablarle: "Voy a pedir que te revisen. Me quedo aquí contigo."', accion: 'llamar', d: 5, ok: 'ok',
  fb: 'Aunque haya despertado, hay que llamar: la naloxona puede pasarse antes que la droga y necesita que la revisen.' };

const DESPERTAR = {
  // Adulto que usa sustancias (casos 1 y 3): se enoja porque "le quitaron la nota".
  nota: {
    lo: 'lo',
    variantes: [
      { emocion: 'enojo', agit: 70, escena: 'Se sienta de golpe, sudando y temblando, y te empuja la mano.', dice: '"¡¿Qué me hiciste?! ¡Me tumbaste la nota!"' },
      { emocion: 'enojo', agit: 60, escena: 'Abre los ojos, ve el dispositivo de Narcan en el piso y se pone furioso.', dice: '"¿Me echaste Narcan? ¡Eso me costó chavos! Ahora me siento malísimo."' },
      { emocion: 'enojo', agit: 75, escena: 'Se incorpora a medias, mareado, y busca sus cosas con la mirada.', dice: '"Déjame quieto. Yo estoy bien. Me voy."' },
      { emocion: 'asco', agit: 55, escena: 'Se sienta con arcadas, se limpia la boca con la mano y te mira de mala gana.', dice: '"¡Qué asco! ¿Qué me echaste en la nariz? Me siento horrible."' },
      { emocion: 'gratitud', agit: 35, escena: 'Abre los ojos despacio, tose y se queda mirándote, asustado.', dice: '"¿Qué pasó?… Pensé que me moría. Gracias, de verdad."' },
      { emocion: 'verguenza', agit: 45, escena: 'Se sienta, baja la cabeza y evita mirarte.', dice: '"Ay, no… No le digas a nadie, por favor. Qué vergüenza."' },
    ],
    turnos: [
      { o: [
        { t: 'Hablarle bajo y despacio: "Estás a salvo. Dejaste de respirar y te di Narcan. Estoy aquí contigo."', d: -25, ok: 'ok',
          fb: 'Decir con calma qué pasó y que está a salvo baja la tensión. Habla bajo y no te le pegues mucho.' },
        { t: '"Tranquilo, cálmate, cálmate."', d: -5, ok: 'mid', fb: 'Pedir calma sin explicar nada casi nunca calma. Primero dile qué pasó.' },
        { t: '"¡Casi te mueres por andar usando esa porquería!"', d: 25, ok: 'no', fb: 'Regañar o avergonzar en ese momento sube el enojo. Ya habrá tiempo para hablar.' },
        { t: 'Agarrarlo por los brazos para que no se levante.', d: 30, ok: 'no', fb: 'Sujetar a alguien que acaba de despertar confundido puede hacer que se defienda. Dale espacio y quédate a su lado.' },
        DOSIS_EXTRA,
      ]},
      { alta: '"¡Me siento malísimo! Tengo frío, me duele todo y tengo ganas de vomitar. ¡Por tu culpa!"', baja: '"Me siento malísimo… Tengo frío y me duele todo."', o: [
        { t: '"Eso que sientes es por el Narcan y se va pasando. ¿Quieres agua o algo para taparte? Siéntate aquí conmigo."', d: -25, ok: 'ok',
          fb: 'Explicarle por qué se siente así y ofrecerle algo concreto (agua, una frisa, sentarse) ayuda a que se calme.' },
        { t: '"Ahorita se te pasa."', d: -5, ok: 'mid', fb: 'Está bien, pero dile por qué se siente así y ofrécele algo.' },
        { t: '"Te lo buscaste."', d: 25, ok: 'no', fb: 'Culparlo lo pone a la defensiva. La abstinencia es muy incómoda: muestra empatía.' },
      ]},
      { alta: '"¡Me voy! Tengo que conseguir algo para que se me quite esto."', baja: '"Necesito conseguir algo para que se me quite esto…"', o: [
        { t: '"Te entiendo. Pero el Narcan dura menos que lo que usaste: si usas ahora o te quedas solo, te puede volver la sobredosis. Quédate conmigo hasta que te revisen."', d: -30, ok: 'ok',
          fb: 'Explicar el riesgo sin juzgar y ofrecerle compañía es lo que más ayuda a que se quede.' },
        { t: '"No te vas. Te lo prohíbo."', d: 20, ok: 'no', fb: 'Darle órdenes a un adulto suele empeorar las cosas. Explícale el riesgo y quédate con él.' },
        { t: 'Dejar que se vaya; ya está bien.', accion: 'irse', d: 0, ok: 'no', fb: 'La naloxona dura de 30 a 90 minutos y el fentanilo puede durar más.' },
      ]},
    ],
    fin: {
      calma: 'Respira hondo, se sienta contigo y te dice: "Gracias por no dejarme solo." Todavía tiembla, pero acepta esperar a que lo revisen.',
      malaGana: 'Se queda, pero sigue molesto y mirando la puerta. No le quites el ojo de encima.',
      seVa: 'Se levanta, te grita que lo dejes quieto y se va. Si vuelve a usar, puede caer otra vez sin nadie cerca.',
    },
  },
  // Adolescente (caso 2): miedo a meterse en problemas, enojo con quien la ayudó.
  joven: {
    lo: 'la',
    variantes: [
      { emocion: 'miedo', agit: 65, escena: 'Se despierta asustada y con náuseas. Ve a sus amigos alrededor y se tapa la cara.', dice: '"¿Qué pasó? ¡¿Llamaron a mi mamá?! ¡Me van a matar!"' },
      { emocion: 'enojo', agit: 70, escena: 'Se sienta de golpe, temblando, y se enoja con todos.', dice: '"¡¿Por qué me echaron eso?! ¡Yo estaba bien! ¡Déjenme quieta!"' },
      { emocion: 'asco', agit: 50, escena: 'Tiene arcadas, ve que vomitó y se limpia la cara con asco.', dice: '"¡Qué asco! ¿Vomité delante de todos? ¿Qué me pasó?"' },
      { emocion: 'gratitud', agit: 40, escena: 'Se echa a llorar y te agarra el brazo.', dice: '"Gracias… Tenía mucho miedo. No sabía que esa pastilla me iba a hacer esto."' },
    ],
    turnos: [
      { o: [
        { t: '"Estás a salvo. La pastilla tenía algo muy fuerte y dejaste de respirar. Te di Narcan. No estás en problemas conmigo."', d: -25, ok: 'ok',
          fb: 'Decirle qué pasó, sin regaños, y que está a salvo le baja el miedo.' },
        { t: '"Tus papás se van a enterar de esto."', d: 25, ok: 'no', fb: 'Amenazarla la asusta más y la empuja a irse. Ahora lo importante es su salud.' },
        { t: '"¿Quién te vendió eso? Dímelo ahora mismo."', d: 20, ok: 'no', fb: 'Interrogarla ahora no ayuda. Eso puede esperar: primero que se calme y que la revisen.' },
        { t: '"Cálmate, que no es para tanto."', d: -5, ok: 'mid', fb: 'Sí fue para tanto: dejó de respirar. Explícale con calma lo que pasó.' },
        DOSIS_EXTRA,
      ]},
      { alta: '"¡Me siento horrible! Tengo ganas de vomitar y me tiemblan las manos."', baja: '"Me siento mal… Tengo ganas de vomitar."', o: [
        { t: '"Es normal sentirse así después del Narcan, y se va pasando. Si vas a vomitar, te pongo de lado; aquí estoy. ¿Quieres agua?"', d: -25, ok: 'ok',
          fb: 'Explicarle los síntomas y quedarte cerca le da seguridad. Si vomita, de lado para que no se ahogue.' },
        { t: '"Eso te pasa por tomarte cosas de la calle."', d: 20, ok: 'no', fb: 'El regaño puede esperar. Ahora necesita sentirse segura para quedarse.' },
        { t: '"Ahorita se te pasa."', d: -5, ok: 'mid', fb: 'Está bien, pero dile por qué se siente así y que no la vas a dejar sola.' },
      ]},
      { alta: '"¡Me quiero ir a mi casa ahora! Nadie se puede enterar de esto."', baja: '"Quiero irme a mi casa… ¿Tengo que ir al hospital?"', o: [
        { t: '"Te entiendo. Pero lo que tenía la pastilla puede durar más que el Narcan y podrías volver a dejar de respirar. Quédate conmigo hasta que te revisen. Yo te acompaño."', d: -30, ok: 'ok',
          fb: 'Explicar el riesgo sin juzgar y acompañarla es lo que más ayuda a que se quede.' },
        { t: '"Si no te quedas, llamo a la policía."', d: 25, ok: 'no', fb: 'Amenazar con la policía rompe la confianza y hace que la próxima vez no pidan ayuda.' },
        { t: 'Dejar que se vaya con sus amigos.', accion: 'irse', d: 0, ok: 'no', fb: 'La naloxona puede pasarse antes que lo que tenía la pastilla. Si vuelve a caer, puede que nadie se dé cuenta a tiempo.' },
      ]},
    ],
    fin: {
      calma: 'Se seca las lágrimas, se sienta a tu lado y te dice bajito: "Gracias por quedarte." Acepta esperar a que la revisen.',
      malaGana: 'Se queda, pero de brazos cruzados y sin hablar. No la dejes sola.',
      seVa: 'Agarra el celular y se va con dos amigos. Nadie se queda vigilando su respiración.',
    },
  },
  // Adulto mayor (caso 4): despierta confundido e irritable; no buscaba una "nota".
  mayor: {
    lo: 'lo',
    variantes: [
      { emocion: 'confusion', agit: 60, escena: 'Abre los ojos confundido y trata de levantarse agarrándose de la cama.', dice: '"¿Quién es usted? ¿Qué hace en mi cuarto?"' },
      { emocion: 'enojo', agit: 55, escena: 'Despierta molesto, sudando y con dolor en todo el cuerpo.', dice: '"¡¿Qué me hicieron?! ¡Me duele todo! Yo solo me tomé mis pastillas."' },
      { emocion: 'gratitud', agit: 35, escena: 'Busca con la mirada a su hija, le aprieta la mano y se le aguan los ojos.', dice: '"Ay, mija… Gracias. Yo no sé qué me pasó."' },
      { emocion: 'verguenza', agit: 45, escena: 'Se tapa la cara con la mano, avergonzado.', dice: '"Qué vergüenza con ustedes… Yo nunca hago estas cosas."' },
    ],
    turnos: [
      { o: [
        { t: '"Don Ramón, mire: aquí está su hija, y yo soy de al lado. Usted tomó más pastillas de la cuenta, dejó de respirar y le dimos un medicamento. Ya está a salvo."', d: -25, ok: 'ok',
          fb: 'Usar su nombre, hablar despacio y decirle quién está con él lo orienta. Una persona mayor que despierta confundida necesita saber dónde está y qué pasó.' },
        { t: '"¿Cuántas se tomó? ¿Cuáles? ¿A qué hora?"', d: 15, ok: 'mid',
          fb: 'Muchas preguntas a la vez lo confunden más. Esas respuestas son para los paramédicos: guarda el frasco y dáselo cuando lleguen.' },
        { t: '"Usted no puede estar tomando pastillas así. ¿Está loco?"', d: 25, ok: 'no', fb: 'Regañarlo lo avergüenza y lo pone a la defensiva. Casi siempre fue un accidente.' },
        DOSIS_EXTRA,
      ]},
      { alta: '"¡Me duele todo y tengo náuseas! ¡Déjenme acostarme!"', baja: '"Me duele todo… Tengo náuseas."', o: [
        { t: '"Eso es por el medicamento que le dimos, y se va pasando. Quédese sentado con nosotros. Si va a vomitar, lo ponemos de lado."', d: -25, ok: 'ok',
          fb: 'Explicarle por qué se siente así y quedarse con él lo calma. Si vomita, de lado para que no se ahogue.' },
        { t: '"Tómese otra pastilla para el dolor, para que se le pase."', d: -10, ok: 'no',
          fb: 'Nunca le des más de esas pastillas: fueron las que causaron la sobredosis. Lo calma un momento, pero lo pone en peligro.' },
        { t: '"Aguante, ya mismo se le pasa."', d: -5, ok: 'mid', fb: 'Está bien, pero dile por qué se siente así y que no lo van a dejar solo.' },
      ]},
      { alta: '"¡No quiero ambulancia! No quiero molestar a nadie."', baja: '"No hace falta ambulancia… Ya estoy bien, ¿verdad?"', o: [
        { t: '"No es molestia. Lo tienen que revisar: las pastillas pueden durar más que el medicamento que le dimos. Su hija y yo nos quedamos con usted."', d: -30, ok: 'ok',
          fb: 'Explicarle el riesgo con respeto y acompañarlo ayuda a que acepte que lo revisen.' },
        { t: '"Bueno, si usted no quiere, cancelo la ambulancia."', accion: 'cancelar', d: -15, ok: 'no',
          fb: 'Lo calma, pero no es seguro: la naloxona puede pasarse antes que las pastillas y puede volver a dejar de respirar.' },
        { t: 'Dejarlo solo para que descanse.', accion: 'irse', d: 0, ok: 'no', fb: 'La naloxona puede pasarse antes que las pastillas. No lo dejes solo.' },
      ]},
    ],
    fin: {
      calma: 'Le agarra la mano a su hija, les da las gracias a los dos y se queda tranquilo. Acepta que lo revisen.',
      calmaSinAmbulancia: 'Le agarra la mano a su hija, les da las gracias a los dos y se queda tranquilo, pero ya nadie viene a revisarlo. Todavía puedes llamar al 9-1-1.',
      malaGana: 'Se queda sentado, refunfuñando. Su hija y tú siguen a su lado.',
      seVa: 'Les pide que se vayan de su casa y se encierra en el cuarto. Nadie está vigilando su respiración.',
    },
  },
};

export { CASE_INFO, DIVISION_HTML, ACTIONS, DOING, NARC_STEPS, DESPERTAR, DOSIS_EXTRA, LLAMAR };
