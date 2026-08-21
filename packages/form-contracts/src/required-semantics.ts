import type { FormField } from './index.js';

/**
 * Semántica de la obligatoriedad, en un solo lugar para las tres capas.
 *
 * Hay dos formas de declarar que un campo es obligatorio y **son excluyentes**:
 *
 * - `rules.required: true` — obligatoriedad fija.
 * - `conditions.required` — obligatoriedad condicional.
 *
 * Declarar las dos es ambiguo y silencioso: la fija gana y la condición queda
 * muerta, así que el autor cree haber configurado "obligatorio cuando X" y en
 * realidad configuró "siempre obligatorio". Por eso el contrato la rechaza.
 *
 * La obligatoriedad **sí** convive con la visibilidad y la habilitación
 * condicionales, y significa *"obligatorio cuando está visible y habilitado"*:
 * un campo que no se muestra no se exige y no viaja en el payload. Esa lectura
 * ya era la del validador; acá queda explícita y compartida con el renderer.
 *
 * Vive en su propio subpath —igual que `field-rules`— porque el editor corre
 * sobre Turbopack, que no resuelve los especificadores `.js` que exige NodeNext
 * en el resto del paquete. Solo tiene imports de tipo, que se borran al compilar.
 */

export const REQUIRED_CONFLICT_MESSAGE =
  'Un campo obligatorio no puede tener además obligatoriedad condicional: dejá solo una de las dos';

/** Las dos formas de declarar obligatoriedad están activas a la vez. */
export function hasRequiredConflict(field: Pick<FormField, 'rules' | 'conditions'>): boolean {
  return Boolean(field.rules.required) && Boolean(field.conditions?.required);
}
