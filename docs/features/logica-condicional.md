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

## Compatibilidad con la obligatoriedad fija

Hay dos formas de declarar que un campo es obligatorio, y **son excluyentes**:

| Forma | Dónde |
| --- | --- |
| Fija | `rules.required: true` |
| Condicional | `conditions.required` |

**Declarar las dos está prohibido.** Es ambiguo y falla en silencio: la fija gana y la condición queda muerta, así que el autor cree haber configurado *"obligatorio cuando X"* y en realidad configuró *"siempre obligatorio"*. El contrato lo rechaza aunque se llame a la API directamente, y el editor deshabilita la opción que sobra en cuanto una de las dos está activa.

En el editor, **Obligatoriedad** y **Lógica condicional** son tarjetas opcionales que se agregan desde el menú del campo. Si una definición ya las tiene, se muestran plegadas con un resumen; al abrirlas, la opción que entra en conflicto queda deshabilitada. Una definición antigua que trae ambas activas mantiene las dos editables para poder repararla.

Con una excepción deliberada: si una definición **ya trae las dos** —guardada antes de esta regla—, el editor **no bloquea ninguna**, para que se pueda desmarcar una y repararla. Bloquear ambas la dejaría sin salida: no se puede guardar por el conflicto y no se puede resolver el conflicto. Apenas queda una sola activa, el bloqueo vuelve.

### Solo lectura y obligatoriedad

Un campo de solo lectura que **pueda llegar a exigirse** necesita `defaultValue`, y eso incluye la obligatoriedad **condicional**, no solo la fija. El campo no se puede completar, así que sin valor por defecto el formulario queda imposible de enviar en cuanto la condición se cumple — y el problema aparecería recién en runtime. La regla está en `canBecomeRequired` (`packages/form-contracts/src/required-semantics.ts`) y la aplican el contrato y el editor.

### La obligatoriedad sí convive con las otras condiciones

Un campo obligatorio con visibilidad, inclusión o habilitación condicional es una configuración legítima y significa:

> **Obligatorio cuando está visible, incluido y habilitado.**

Un campo oculto, excluido o deshabilitado **no se exige**, aunque sea obligatorio fijo. Prohibir la combinación obligaría al autor a duplicar la condición de visibilidad dentro de una condición de obligatoriedad, que es peor.

### Un único criterio para las tres capas

La obligatoriedad **declarada** (`isFieldRequired`) es solo una parte. La **efectiva** —la que decide si se exige un valor— se arma así, y las condiciones de **todos** los ancestros cuentan igual que las propias: la sección que lo contiene y también el formulario completo. Si el formulario está deshabilitado, `validateSubmission` corta antes de recorrer los campos y no exige ninguno, así que el asterisco tampoco puede aparecer:

```
visible ∧ incluido ∧ habilitado ∧ obligatorio
```

| Capa | Dónde se arma |
| --- | --- |
| Contrato | `validateSubmission`, al exigir un valor |
| Runtime | `DynamicField`, para pintar el asterisco del `<label>` |
| CMS | el editor explica la semántica junto a las opciones |

Que el renderer use el mismo criterio que el validador es lo que garantiza que **el asterisco signifique exactamente lo que el servidor va a exigir**. No se factoriza en un helper porque hace falta el contexto del contenedor, y un helper que solo mirara el campo volvería a divergir del validador — que es justo el problema que esto resuelve.

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
| Semántica de la obligatoriedad | `packages/form-contracts/src/required-semantics.ts` (`hasRequiredConflict`, `REQUIRED_CONFLICT_MESSAGE`) |
| Obligatoriedad efectiva | `packages/form-contracts/src/validation.ts` y `apps/form-remote/src/features/runtime/ui/fields/dynamic-field.tsx` |

## Historial de cambios

- **2026-08-29** — Obligatoriedad y Lógica condicional pasaron a tarjetas opcionales del editor, con apertura automática de errores y una salida explícita para reparar definiciones antiguas conflictivas.
- **2026-08-20** — El editor pasó de una única regla con cuatro operadores a reglas múltiples con los diez operadores del contrato, selector visual de lógica `all`/`any` y valores múltiples para `in`/`notIn`. Se corrigió el selector de campos candidatos, que ofrecía celdas de grilla y producía definiciones que el BFF rechazaba.
- **2026-08-21** — Se agregaron definiciones v3, variables externas tipadas, grupos anidados, inclusión independiente, condiciones jerárquicas y revalidación mediante contexto firmado en el BFF.
- **2026-08-21** — Se fijó la compatibilidad entre obligatoriedad fija y lógica condicional. Declarar `rules.required` junto con `conditions.required` pasó a ser inválido: el contrato lo rechaza aunque se llame a la API directamente, y el editor deshabilita la opción que sobra. La obligatoriedad fija con visibilidad, inclusión o habilitación condicional queda definida como "obligatorio cuando está visible, incluido y habilitado".
- **2026-08-22** — Revisión técnica. La exigencia de `defaultValue` en campos de solo lectura pasó a cubrir la obligatoriedad condicional además de la fija. Y cuando una definición ya trae las dos obligatoriedades, el editor deja de bloquear ambas para que se pueda desmarcar una y repararla.
- **2026-08-26** — La habilitación del formulario completo se propaga a los contenedores, igual que la inclusión: antes solo se heredaba la del contenedor, así que un campo obligatorio mostraba el asterisco con el formulario deshabilitado, donde el servidor no exige nada.
