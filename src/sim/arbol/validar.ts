// Validación del árbol de decisiones y de su contenido, antes de ejecutarlo. Devuelve errores (el árbol no debe
// usarse) y advertencias (se puede usar, pero hay algo pendiente), con mensajes en español.
import { CLINICA } from '../config/clinica';
import type { CaseDefinition, Clasificacion, DecisionNode, DecisionTree, DialogueProfile } from '../tipos';
import { EsquemaArbol, EsquemaCaso, EsquemaDialogo } from './esquemas';

export interface Problema { codigo: string; mensaje: string; nodo?: string }
export interface ResultadoValidacion { errores: Problema[]; advertencias: Problema[] }

export interface OpcionesValidacion {
  caso?: CaseDefinition;
  dialogos?: Record<string, DialogueProfile>;
  /** Textos del idioma principal (es-PR): una clave que falte es un error. */
  textos?: Record<string, string>;
  /** Textos de otros idiomas: una clave que falte es una advertencia (traducción pendiente). */
  otrosIdiomas?: Record<string, Record<string, string>>;
}

const RUTAS: Record<'respuesta' | 'respiracion' | 'respiracion_propia', Clasificacion[]> = {
  respuesta: ['responde', 'no_responde'],
  respiracion: ['respira_normal', 'respira_anormal', 'no_respira'],
  respiracion_propia: ['respira_normal', 'respira_anormal', 'no_respira'],
};

function destinos(n: DecisionNode): string[] {
  return [
    ...(n.next ? [n.next] : []),
    ...(n.omitirA ? [n.omitirA] : []),
    ...(n.options ?? []).map((o) => o.next),
    ...Object.values(n.routes ?? {}).filter((x): x is string => Boolean(x)),
  ];
}

export function clavesDelArbol(tree: DecisionTree, caso?: CaseDefinition): string[] {
  const k: string[] = [];
  for (const n of tree.nodes) {
    k.push(n.promptKey, ...Object.values(n.promptKeyPorPerfil ?? {}).filter((x): x is string => Boolean(x)), ...(n.pistaKey ? [n.pistaKey] : []));
    for (const o of n.options ?? []) k.push(o.labelKey, ...(o.feedbackKey ? [o.feedbackKey] : []));
  }
  if (caso) {
    k.push(caso.tituloKey, caso.introKey, caso.lugarKey, ...caso.objetivos.map((o) => o.textKey));
    for (const a of caso.accionesCriticas) k.push(`retro.hecho.${a}`, `retro.falta.${a}`);
  }
  return [...new Set(k)];
}

export function validateDecisionTree(tree: DecisionTree, op: OpcionesValidacion = {}): ResultadoValidacion {
  const errores: Problema[] = [];
  const advertencias: Problema[] = [];
  const err = (codigo: string, mensaje: string, nodo?: string) => errores.push({ codigo, mensaje, nodo });
  const adv = (codigo: string, mensaje: string, nodo?: string) => advertencias.push({ codigo, mensaje, nodo });

  // 1. Forma del contenido
  const forma = EsquemaArbol.safeParse(tree);
  if (!forma.success) for (const i of forma.error.issues) err('esquema', `Árbol: ${i.path.join('.')}: ${i.message}`);

  // 2. Identificadores duplicados
  const ids = new Map<string, DecisionNode>();
  for (const n of tree.nodes) {
    if (ids.has(n.id)) err('id_duplicado', `El nodo "${n.id}" está repetido.`, n.id);
    ids.set(n.id, n);
    const vistas = new Set<string>();
    for (const o of n.options ?? []) {
      if (vistas.has(o.id)) err('opcion_duplicada', `La opción "${o.id}" está repetida en "${n.id}".`, n.id);
      vistas.add(o.id);
    }
  }

  // 3. Destinos que no existen
  if (!ids.has(tree.inicio)) err('sin_destino', `El nodo de inicio "${tree.inicio}" no existe.`);
  for (const n of tree.nodes)
    for (const d of destinos(n)) if (!ids.has(d)) err('sin_destino', `"${n.id}" apunta a "${d}", que no existe.`, n.id);
  for (const [ev, d] of Object.entries(tree.interrupciones))
    if (d && !ids.has(d)) err('sin_destino', `La interrupción "${ev}" apunta a "${d}", que no existe.`);

  // 4. Reglas de cada tipo de nodo
  for (const n of tree.nodes) {
    const opciones = n.options ?? [];
    if (['information', 'naloxone_practice', 'dialogue'].includes(n.type) && !n.next)
      err('sin_destino', `El nodo "${n.id}" (${n.type}) no tiene "next".`, n.id);
    if (['choice', 'cpr_practice'].includes(n.type) && opciones.length === 0)
      err('sin_opciones', `El nodo "${n.id}" no tiene opciones.`, n.id);
    if (n.type === 'assessment') {
      if (!n.evalua) err('evaluacion_incompleta', `El nodo "${n.id}" no dice qué evalúa.`, n.id);
      else for (const c of RUTAS[n.evalua]) if (!n.routes?.[c]) err('evaluacion_incompleta', `El nodo "${n.id}" no tiene ruta para "${c}".`, n.id);
      for (const d of Object.values(n.routes ?? {})) if (d && ids.get(d)?.type === 'assessment')
        err('evaluacion_en_cadena', `La evaluación "${n.id}" lleva a otra evaluación ("${d}").`, n.id);
    }
    if (n.type === 'outcome' && (opciones.length || n.next)) err('resultado_con_salida', `El resultado "${n.id}" no debe tener salidas.`, n.id);
    if (Boolean(n.omitirSi) !== Boolean(n.omitirA))
      err('omitir_incompleto', `El nodo "${n.id}" necesita "omitirSi" y "omitirA" juntos.`, n.id);
    for (const o of opciones) {
      if (!o.feedbackKey) err('sin_retroalimentacion', `La opción "${o.id}" de "${n.id}" no tiene retroalimentación.`, n.id);
      // Dosis adicionales: siempre con dispositivo nuevo y después del intervalo configurado.
      if (o.effects?.dosisNueva && !(o.requiere?.includes('intervalo_dosis_cumplido') && o.requiere.includes('quedan_dispositivos')))
        err('dosis_sin_criterio', `La opción "${o.id}" de "${n.id}" da otra dosis sin exigir el intervalo de ${CLINICA.intervaloSegundaDosisS} s y un dispositivo nuevo.`, n.id);
      // Terminar el caso como respuesta correcta exige haber llamado al 9-1-1.
      const termina = ids.get(o.next)?.type === 'outcome';
      if (termina && o.calidad !== 'incorrecta' && !o.requiere?.includes('con_911'))
        err('termina_sin_911', `La opción "${o.id}" de "${n.id}" termina el caso sin exigir la llamada al 9-1-1.`, n.id);
      if (n.requiere911 && termina && o.calidad === 'incorrecta' && !o.effects?.irse)
        adv('termina_sin_911', `La opción incorrecta "${o.id}" de "${n.id}" termina el caso.`, n.id);
    }
  }
  if (tree.nodes.filter((n) => n.esPrimeraDosis).length !== 1)
    err('primera_dosis', 'Debe haber exactamente un nodo de primera dosis de naloxona (esPrimeraDosis).');

  // 5. Alcanzables desde el inicio (las interrupciones se pueden dar desde cualquier nodo)
  const raices = [tree.inicio, ...Object.values(tree.interrupciones).filter((x): x is string => Boolean(x))];
  const alcanzados = new Set<string>();
  const pila = raices.filter((r) => ids.has(r));
  while (pila.length) {
    const x = pila.pop() as string;
    if (alcanzados.has(x)) continue;
    alcanzados.add(x);
    const n = ids.get(x);
    if (n) pila.push(...destinos(n).filter((d) => ids.has(d)));
  }
  for (const n of tree.nodes) if (!alcanzados.has(n.id)) err('inalcanzable', `El nodo "${n.id}" no se puede alcanzar.`, n.id);

  // 6. Todo nodo debe poder llegar a un resultado
  const llegan = new Set(tree.nodes.filter((n) => n.type === 'outcome').map((n) => n.id));
  if (llegan.size === 0) err('sin_resultado', 'El árbol no tiene ningún nodo de resultado.');
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const n of tree.nodes)
      if (!llegan.has(n.id) && destinos(n).some((d) => llegan.has(d))) { llegan.add(n.id); cambio = true; }
  }
  for (const n of tree.nodes) if (!llegan.has(n.id)) err('sin_salida', `Desde "${n.id}" no se puede llegar a un resultado.`, n.id);

  // 7. Caso, diálogo, textos y género
  const caso = op.caso;
  if (caso) {
    const c = EsquemaCaso.safeParse(caso);
    if (!c.success) for (const i of c.error.issues) err('esquema', `Caso: ${i.path.join('.')}: ${i.message}`);
    if (caso.objetivos.length === 0) err('sin_objetivos', `El caso "${caso.id}" no tiene objetivos educativos.`);
    const d = op.dialogos?.[caso.dialogo];
    if (!d) err('dialogo_inexistente', `El caso "${caso.id}" usa el perfil de diálogo "${caso.dialogo}", que no existe.`);
    else {
      const dd = EsquemaDialogo.safeParse(d);
      if (!dd.success) for (const i of dd.error.issues) err('esquema', `Diálogo ${caso.dialogo}: ${i.path.join('.')}: ${i.message}`);
      if (d.turnos.length !== CLINICA.dialogo.turnos) adv('turnos', `El diálogo "${caso.dialogo}" tiene ${d.turnos.length} turnos; la configuración dice ${CLINICA.dialogo.turnos}.`);
      if ((d.lo === 'la') !== (caso.persona.genero === 'f'))
        err('genero', `El diálogo "${caso.dialogo}" usa "${d.lo}" y la persona del caso "${caso.id}" es de género "${caso.persona.genero}".`);
    }
  }
  if (op.textos) {
    const textos = op.textos;
    for (const k of clavesDelArbol(tree, caso)) if (!textos[k]) err('texto_faltante', `Falta el texto "${k}" en es-PR.`);
    for (const k of Object.keys(textos)) {
      const m = /^(.*)\.(m|f)$/.exec(k);
      if (m && !textos[`${m[1]}.${m[2] === 'm' ? 'f' : 'm'}`]) err('genero', `El texto "${k}" no tiene su variante de ${m[2] === 'm' ? 'femenino' : 'masculino'}.`);
    }
    for (const [idioma, otros] of Object.entries(op.otrosIdiomas ?? {})) {
      const faltan = clavesDelArbol(tree, caso).filter((k) => !otros[k]);
      if (faltan.length) adv('traduccion_pendiente', `${idioma}: faltan ${faltan.length} textos (traducción pendiente de aprobación).`);
    }
  }
  return { errores, advertencias };
}
