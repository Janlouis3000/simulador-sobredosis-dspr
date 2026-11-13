// Recursos de ayuda de la División (los de CLAUDE.md; no se inventan otros). Reemplaza a DIVISION_HTML en el
// simulador con árbol: son datos y los muestra un componente con enlaces reales, sin innerHTML.
import type { ContactResource, NaloxoneStep, NaloxoneVisualAsset } from '../sim/tipos';

export const CONTACTOS: ContactResource[] = [
  { id: 'napro', labelKey: 'contacto.napro', value: '787-765-2929, ext. 2253', href: 'tel:+17877652929,2253', type: 'phone' },
  { id: 'educacion', labelKey: 'contacto.educacion', value: '787-765-2929, ext. 3777 o 3682', href: 'tel:+17877652929,3777', type: 'phone' },
  { id: 'correo', labelKey: 'contacto.correo', value: 'opioides@salud.pr.gov', href: 'mailto:opioides@salud.pr.gov', type: 'email' },
  { id: 'web', labelKey: 'contacto.web', value: 'www.salud.pr.gov/opioides', href: 'https://www.salud.pr.gov/opioides', type: 'url' },
  { id: 'pas', labelKey: 'contacto.pas', value: '1-800-981-0023 o 988', href: 'tel:+18009810023', type: 'phone', availabilityKey: 'contacto.pas.disponible' },
];

// Demostración de la naloxona nasal, paso a paso. Sigue el protocolo DSPR (pasos 4 a 7) y la guía de NARCAN.
// El paso "inclinar la cabeza" no está en la lista de naloxona del protocolo DSPR: el texto aprobado lo
// menciona al abrir la vía aérea. Se marca para revisión.
export const PASOS_NALOXONA: NaloxoneStep[] = [
  { id: 'empaque', textKey: 'naloxona.paso.empaque', altKey: 'naloxona.alt.empaque', ilustracion: 'empaque' },
  { id: 'no_probar', textKey: 'naloxona.paso.no_probar', altKey: 'naloxona.alt.no_probar', ilustracion: 'no_probar' },
  { id: 'pulgar', textKey: 'naloxona.paso.pulgar', altKey: 'naloxona.alt.pulgar', ilustracion: 'pulgar' },
  { id: 'dedos', textKey: 'naloxona.paso.dedos', altKey: 'naloxona.alt.dedos', ilustracion: 'dedos' },
  { id: 'cabeza', textKey: 'naloxona.paso.cabeza', altKey: 'naloxona.alt.cabeza', ilustracion: 'cabeza', requiereRevisionClinica: true },
  { id: 'introducir', textKey: 'naloxona.paso.introducir', altKey: 'naloxona.alt.introducir', ilustracion: 'introducir' },
  { id: 'presionar', textKey: 'naloxona.paso.presionar', altKey: 'naloxona.alt.presionar', ilustracion: 'presionar' },
  { id: 'retirar', textKey: 'naloxona.paso.retirar', altKey: 'naloxona.alt.retirar', ilustracion: 'retirar' },
  { id: 'continuar', textKey: 'naloxona.paso.continuar', altKey: 'naloxona.alt.continuar', ilustracion: 'continuar' },
  { id: 'nuevo', textKey: 'naloxona.paso.nuevo', altKey: 'naloxona.alt.nuevo', ilustracion: 'nuevo' },
];

// Modelos 3D de la demostración: todavía no hay GLB del dispositivo, la cabeza ni la mano. Sin URLs, la interfaz
// usa la secuencia ilustrada (fallbackImages son los id de las ilustraciones SVG de components/IlustracionNaloxona).
export const ASSET_NALOXONA: NaloxoneVisualAsset = {
  fallbackImages: PASOS_NALOXONA.map((p) => p.ilustracion),
};
