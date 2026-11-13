// Imprime los desenlaces de calibración con el mismo formato que el test.js de la v2.
// Uso: npm run calibrar
import { SCENARIOS, run, line } from '../src/escenarios.js';

let group = null;
for (const sc of SCENARIOS) {
  if (sc.caseId !== group) { group = sc.caseId; console.log('--', group); }
  console.log(line(run(sc.caseId, sc.plan, sc.verbose ? console.log : null)));
}
