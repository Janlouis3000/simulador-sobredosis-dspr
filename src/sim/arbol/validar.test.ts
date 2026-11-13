import { describe, expect, it } from 'vitest';
import en from '../../content/locales/en-US.json';
import es from '../../content/locales/es-PR.json';
import { DIALOGOS } from '../../arbol/contexto';
import { CASOS_ARBOL, FENTANILO } from '../casos/casos';
import type { CaseDefinition, DecisionTree } from '../tipos';
import { ARBOL } from './arbol';
import { validateDecisionTree } from './validar';

const copia = (): DecisionTree => structuredClone(ARBOL);
const validar = (tree: DecisionTree, caso: CaseDefinition = FENTANILO, textos: Record<string, string> = es) =>
  validateDecisionTree(tree, { caso, dialogos: DIALOGOS, textos, otrosIdiomas: { 'en-US': en } });
const codigos = (r: ReturnType<typeof validar>) => r.errores.map((e) => e.codigo);

describe('validateDecisionTree: el árbol real', () => {
  it.each(Object.values(CASOS_ARBOL))('no tiene errores con el caso $id', (caso) => {
    const r = validar(ARBOL, caso);
    expect(r.errores).toEqual([]);
  });
  it('avisa que el inglés está pendiente, sin bloquear', () => {
    expect(validar(ARBOL).advertencias.map((a) => a.codigo)).toContain('traduccion_pendiente');
  });
});

describe('validateDecisionTree: detecta problemas', () => {
  it('nodo huérfano (inalcanzable)', () => {
    const t = copia();
    t.nodes.push({ id: 'huerfano', type: 'information', promptKey: 'nodo.aviso.prompt', next: 'resultado' });
    expect(codigos(validar(t))).toContain('inalcanzable');
  });
  it('identificador duplicado', () => {
    const t = copia();
    t.nodes.push({ ...(t.nodes[0] as DecisionTree['nodes'][number]) });
    expect(codigos(validar(t))).toContain('id_duplicado');
  });
  it('destino inexistente', () => {
    const t = copia();
    const n = t.nodes.find((x) => x.id === 'operador');
    if (n) n.next = 'no_existe';
    expect(codigos(validar(t))).toContain('sin_destino');
  });
  it('nodo que no puede llegar a un resultado', () => {
    const t = copia();
    t.nodes.push({ id: 'trampa', type: 'choice', promptKey: 'nodo.aviso.prompt', options: [{ id: 'otra_vez', labelKey: 'op.llamar.esperar', feedbackKey: 'fb.llamar.esperar', next: 'trampa', calidad: 'incorrecta' }] });
    const n = t.nodes.find((x) => x.id === 'seguridad');
    n?.options?.push({ id: 'a_la_trampa', labelKey: 'op.llamar.esperar', feedbackKey: 'fb.llamar.esperar', next: 'trampa', calidad: 'incorrecta' });
    expect(codigos(validar(t))).toContain('sin_salida');
  });
  it('opción sin retroalimentación', () => {
    const t = copia();
    const o = t.nodes.find((x) => x.id === 'llamar')?.options?.[0];
    if (o) delete o.feedbackKey;
    expect(codigos(validar(t))).toContain('sin_retroalimentacion');
  });
  it('texto faltante en es-PR', () => {
    const textos = { ...es } as Record<string, string>;
    delete textos['op.llamar.altavoz'];
    expect(codigos(validar(ARBOL, FENTANILO, textos))).toContain('texto_faltante');
  });
  it('perfil de diálogo inexistente', () => {
    expect(codigos(validar(ARBOL, { ...FENTANILO, dialogo: 'no_existe' }))).toContain('dialogo_inexistente');
  });
  it('caso sin objetivos educativos', () => {
    expect(codigos(validar(ARBOL, { ...FENTANILO, objetivos: [] }))).toContain('sin_objetivos');
  });
  it('terminar el caso sin exigir la llamada al 9-1-1', () => {
    const t = copia();
    const o = t.nodes.find((x) => x.id === 'esperar')?.options?.find((x) => x.id === 'quedarse');
    if (o) o.requiere = [];
    expect(codigos(validar(t))).toContain('termina_sin_911');
  });
  it('dosis adicional sin el criterio configurado', () => {
    const t = copia();
    const o = t.nodes.find((x) => x.id === 'decidir')?.options?.find((x) => x.id === 'segunda_dosis');
    if (o) o.requiere = ['quedan_dispositivos'];
    expect(codigos(validar(t))).toContain('dosis_sin_criterio');
  });
  it('variante de género faltante y pronombre que no coincide', () => {
    const textos = { ...es, 'prueba.algo.m': 'Alterado' } as Record<string, string>;
    expect(codigos(validar(ARBOL, FENTANILO, textos))).toContain('genero');
    expect(codigos(validar(ARBOL, { ...FENTANILO, persona: { tipo: 'h', genero: 'f' } }))).toContain('genero');
  });
  it('evaluación sin ruta para una clasificación', () => {
    const t = copia();
    const n = t.nodes.find((x) => x.id === 'reevaluar');
    if (n?.routes) delete n.routes.no_respira;
    expect(codigos(validar(t))).toContain('evaluacion_incompleta');
  });
});
