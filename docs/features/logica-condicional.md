# Lógica condicional

> **Mantené este documento al día.** Si agregás un operador, cambiás dónde se pueden usar condiciones o cómo se evalúan, actualizá este documento y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Que un formulario reaccione a lo que la persona va completando: mostrar el campo "Nombre del testigo" solo si respondió que hubo testigos, exigir un detalle solo cuando eligió "Otro", deshabilitar un campo mientras no se cumpla una precondición.

Sin esto, el autor tendría que publicar un formulario distinto por cada combinación.

## Cómo funciona

Cada campo puede declarar tres condiciones independientes:

| Condición | Efecto cuando **no** se cumple |
| --- | --- |
| `visible` | El campo no se renderiza y su valor no se envía. |
| `enabled` | El campo se renderiza deshabilitado y su valor no se envía. |
| `required` | El campo deja de ser obligatorio. |

Un campo sin condición declarada se considera visible, habilitado y con la obligatoriedad que indiquen sus reglas.

### Grupos y reglas

Una condición es un **grupo** con una lógica y una o más **reglas**:

- **Lógica `all`** — se cumple si se cumplen todas las reglas (Y).
- **Lógica `any`** — se cumple si se cumple al menos una (O).

Cada regla apunta a **otro campo** (`fieldId`), usa un operador y, según el operador, un valor esperado. El contrato exige al menos una regla por grupo, así que el editor no permite quitar la última.

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

El editor adapta el control al operador y al campo de origen: si el campo tiene catálogo ofrece sus opciones, si es una casilla ofrece marcado/sin marcar, si es numérico o el operador es de comparación ofrece un campo numérico, y para `in`/`notIn` ofrece selección múltiple.

### Comparación de valores

Los valores llegan del formulario como texto, así que la comparación coacciona antes de comparar: `10` y `'10'` son iguales, `true` y `'true'` también, y las cadenas se comparan sin espacios al borde. Está en `valuesEqual` (`packages/form-contracts/src/index.ts`) y cubierto por las tablas de `packages/form-contracts/src/evaluation.test.ts`.

Para `empty` / `notEmpty`, se consideran vacíos: `undefined`, `null`, cadena vacía o de solo espacios, y lista vacía.

## Restricciones

| Restricción | Motivo |
| --- | --- |
| No se admiten condiciones dentro de una grilla repetible | Una regla apunta a un campo por id, y las celdas de una grilla existen una vez por fila: no hay un valor único al que apuntar. |
| Una condición no puede apuntar al propio campo | Sería una definición circular trivial. |
| Las dependencias circulares entre campos se rechazan | El contrato recorre el grafo de dependencias al validar y reporta el ciclo completo. |
| El campo referido debe existir y **no** ser una celda de grilla | El editor filtra los candidatos para no ofrecer lo que el contrato después rechaza. |

El editor valida antes de guardar que cada regla esté completa: campo válido, valor esperado presente cuando el operador lo pide, y al menos un valor para `in` / `notIn`.

## Efecto en el payload

Los campos que quedan invisibles o deshabilitados **no viajan** en el envío: `cleanSubmissionPayload` los descarta. Un campo con obligatoriedad condicional solo se exige cuando su condición se cumple.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema de condiciones y evaluación | `packages/form-contracts/src/index.ts` (`conditionGroupSchema`, `evaluateCondition`, `valuesEqual`) |
| Filtrado de payload | `packages/form-contracts/src/index.ts` (`cleanSubmissionPayload`) |
| Editor de condiciones | `apps/web/src/features/cms/ui/condition-editor.tsx` |
| Candidatos válidos | `apps/web/src/features/cms/model/definition.ts` (`otherFields`) |
| Aplicación en runtime | `apps/form-remote/src/features/runtime/ui/fields/dynamic-field.tsx` |
| Tablas de operadores (tests) | `packages/form-contracts/src/evaluation.test.ts` |

## Historial de cambios

- **2026-08-20** — El editor pasó de una única regla con cuatro operadores a reglas múltiples con los diez operadores del contrato, selector visual de lógica `all`/`any` y valores múltiples para `in`/`notIn`. Se corrigió el selector de campos candidatos, que ofrecía celdas de grilla y producía definiciones que el BFF rechazaba.
