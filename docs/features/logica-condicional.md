# Lógica condicional

> **Mantené este documento al día.** Si agregás un operador, cambiás dónde se pueden usar condiciones o cómo se evalúan, actualizá este documento y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Que un formulario reaccione a lo que la persona va completando: mostrar el campo "Nombre del testigo" solo si respondió que hubo testigos, exigir un detalle solo cuando eligió "Otro", deshabilitar un campo mientras no se cumpla una precondición.

Sin esto, el autor tendría que publicar un formulario distinto por cada combinación.

## Cómo funciona

El formulario, cada sección, cada campo y cada bloque informativo pueden declarar condiciones independientes:

| Condición | Efecto cuando **no** se cumple |
| --- | --- |
| `visible` | El elemento no se renderiza y sus datos no se envían. |
| `enabled` | El elemento se renderiza deshabilitado; un campo deja de ser obligatorio, pero un valor existente puede conservarse y validarse. |
| `included` | El elemento puede seguir visible, pero sus datos se excluyen del payload. |
| `required` | El campo deja de ser obligatorio. |

Un campo sin condición declarada se considera visible, habilitado y con la obligatoriedad que indiquen sus reglas.

### Grupos y reglas

Una condición es un grupo con una lógica y una o más reglas o subgrupos. La versión 3 permite anidar grupos para expresar, por ejemplo, `(A Y B) O C`:

- **Lógica `all`** — se cumple si se cumplen todas las reglas (Y).
- **Lógica `any`** — se cumple si se cumple al menos una (O).

Cada regla apunta a otro campo (`source.kind: field`) o a una variable externa declarada (`source.kind: external`), usa un operador y, según el operador, un valor esperado. Las expresiones tienen límites de profundidad y cantidad para que el evaluador siga siendo seguro y predecible.

Las variables externas se declaran en el formulario con nombre, tipo y confianza. Las de `presentation` solo pueden controlar bloques informativos. Las de `trusted` que afectan datos llegan al BFF dentro de un JWT HS256 de corta duración (`X-Form-Context`); el BFF verifica firma, audiencia, formulario, vencimiento y tipos. No son un mecanismo de autorización.

El catálogo y las condiciones se evalúan con el mismo contrato en CMS, renderer y BFF. `DynamicFormProps.externalVariables` aporta el contexto de presentación al runtime y `contextToken` se reenvía en `X-Form-Context`; el BFF vuelve a resolver las variables `trusted` desde el token firmado, sin guardar el contexto ni enviarlo a Dynamics.

### Operadores

| Operador | Etiqueta en el editor | Valor esperado |
| --- | --- | --- |
| `equals` | es igual a | uno |
| `notEquals` | es distinto de | uno |
| `in` | está incluido en | lista |
| `notIn` | no está incluido en | lista |
| `greaterThan` | es mayor que | uno |
| `greaterThanOrEqual` | es mayor o igual que | uno |
| `lessThan` | es menor que | uno |
| `lessThanOrEqual` | es menor o igual que | uno |
| `empty` | está vacío | ninguno |
| `notEmpty` | no está vacío | ninguno |

El editor adapta el control al operador y al origen: si el campo tiene catálogo ofrece sus opciones, si es una casilla o la variable externa es `boolean` ofrece marcado/sin marcar, si es numérico o el operador es de comparación ofrece un campo numérico, y para `in`/`notIn` ofrece selección múltiple. Las variables externas se editan con el tipo declarado.

### Comparación de valores

Los valores llegan del formulario como texto, así que la comparación coacciona antes de comparar: `10` y `'10'` son iguales, `true` y `'true'` también, y las cadenas se comparan sin espacios al borde. Está en `valuesEqual` (`packages/form-contracts/src/index.ts`) y cubierto por las tablas de `packages/form-contracts/src/evaluation.test.ts`.

Para `empty` / `notEmpty`, se consideran vacíos: `undefined`, `null`, cadena vacía o de solo espacios, y lista vacía. Un valor ausente no coincide con `equals`/`in` y sí satisface `notEquals`/`notIn`; un valor incompatible por tipo hace fallar la regla. Los campos internos normalizan la representación de la UI; las variables externas deben llegar con el tipo declarado.

## Restricciones

| Restricción | Motivo |
| --- | --- |
| No se admiten condiciones dentro de una grilla repetible | Una regla apunta a un campo por id, y las celdas de una grilla existen una vez por fila: no hay un valor único al que apuntar. La condición del contenedor controla toda la grilla. |
| Una condición no puede apuntar al propio campo | Sería una definición circular trivial. |
| Las dependencias circulares entre campos se rechazan | El contrato recorre el grafo de dependencias al validar y reporta el ciclo completo. |
| El campo referido debe existir y **no** ser una celda de grilla | El editor filtra los candidatos para no ofrecer lo que el contrato después rechaza. |
| Formulario y sección no dependen de sus propios descendientes | Evita que la visibilidad de un contenedor dependa de un control que dejaría de existir al ocultarlo. |
| Las expresiones tienen límites de seguridad | Hasta 8 niveles anidados y 50 reglas por expresión. |
| Una variable `presentation` solo controla un bloque informativo | Las condiciones que afectan controles o payload deben usar una variable `trusted`. |

El editor valida antes de guardar que cada regla esté completa: campo válido, valor esperado presente cuando el operador lo pide, y al menos un valor para `in` / `notIn`.

## Efecto en el payload

Los campos ocultos o excluidos no se validan ni viajan. Un campo deshabilitado no acepta interacción ni se vuelve obligatorio, pero un valor existente se conserva y se valida si queda incluido. `cleanSubmissionPayload` aplica también las condiciones efectivas del formulario y de la sección.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema de condiciones y evaluación | `packages/form-contracts/src/index.ts` (`conditionGroupSchema`, `evaluateCondition`, `isElementIncluded`, `valuesEqual`) |
| Filtrado de payload | `packages/form-contracts/src/index.ts` (`cleanSubmissionPayload`) |
| Editor de condiciones | `apps/web/src/features/cms/ui/condition-editor.tsx` |
| Candidatos válidos | `apps/web/src/features/cms/model/definition.ts` (`otherFields`) |
| Aplicación en runtime | `apps/form-remote/src/features/runtime/ui/fields/dynamic-field.tsx` |
| Contexto firmado y revalidación | `apps/bff/src/context-token.ts`, `apps/bff/src/submissions.service.ts` |
| Tablas de operadores (tests) | `packages/form-contracts/src/evaluation.test.ts` |

## Historial de cambios

- **2026-08-20** — El editor pasó de una única regla con cuatro operadores a reglas múltiples con los diez operadores del contrato, selector visual de lógica `all`/`any` y valores múltiples para `in`/`notIn`. Se corrigió el selector de campos candidatos, que ofrecía celdas de grilla y producía definiciones que el BFF rechazaba.
- **2026-08-21** — Se agregaron definiciones v3, variables externas tipadas, grupos anidados, inclusión independiente, condiciones jerárquicas y revalidación mediante contexto firmado en el BFF.
