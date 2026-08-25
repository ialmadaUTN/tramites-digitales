# Campos de solo lectura

> **Mantené este documento al día.** Si cambiás cómo se declara, se renderiza o se persiste un campo de solo lectura, actualizá este documento y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Mostrarle al solicitante un dato que **no puede modificar**: una sucursal asignada, un número de póliza precargado, una leyenda fija. El campo se ve en el formulario y su valor viaja en el payload, pero la persona no lo puede editar.

Antes solo existía `defaultValue`, que precarga un valor pero deja que el usuario lo cambie. Eso no sirve cuando el valor tiene que ser exactamente el declarado.

## Cómo funciona

Se declara con `readOnly: true` en el campo. El comportamiento se reparte en tres capas:

### 1. Editor (CMS)

Una casilla **"Solo lectura"** en cada campo, disponible también en las columnas de una grilla. El campo muestra una insignia "Solo lectura" en su encabezado.

### 2. Runtime (formulario publicado)

El renderer bloquea la entrada, y **cómo** la bloquea depende del control:

| Control | Mecanismo | Por qué |
| --- | --- | --- |
| `text`, `textarea`, `email`, `phone`, `alphabetic`, `alphanumeric`, `number`, `date`, `time`, `combobox` | atributo `readonly` del DOM | Conserva el valor en el envío y permite copiarlo. |
| `select`, `checkbox`, `radio`, `multiselect` | atributo `disabled` | El DOM **no soporta `readonly`** en estos controles; sin `disabled` seguirían siendo editables. |

El valor sigue viviendo en el estado del formulario, así que viaja igual en el submit aunque el control esté deshabilitado. La etiqueta muestra el sufijo "(solo lectura)".

Esta distinción es fácil de romper sin darse cuenta: está fijada por los tests de `apps/form-remote/src/features/runtime/ui/fields/fields.test.tsx`, que barren todos los tipos.

### 3. Validación del envío (servidor)

Bloquear la entrada en el navegador no es una garantía: un payload manipulado podría traer cualquier cosa. Por eso `applyReadOnlyDefaults` (en `packages/form-contracts/src/validation.ts`) **reemplaza lo que llegó del cliente por el `defaultValue` declarado en la definición**, antes de validar.

La decisión de diseño es **ignorar** el valor manipulado, no rechazar el envío: rechazarlo le mostraría un error incomprensible a un usuario legítimo cuya única falta fue tener un navegador raro. Se aplica tanto a campos sueltos como a celdas de grilla.

## Reglas

| Regla | Motivo |
| --- | --- |
| `fileUpload` no admite solo lectura | No hay forma de precargar un archivo como valor por defecto. |
| Un campo de solo lectura que **pueda llegar a exigirse** necesita `defaultValue` | Si no, es un campo imposible de completar: exigido y no editable, sin valor. Cuenta la obligatoriedad **fija y la condicional**: con la condicional el problema aparecería recién en runtime, cuando la condición se cumple. Lo decide `canBecomeRequired` en `packages/form-contracts/src/required-semantics.ts`. |
| Requiere `schemaVersion: 2` | Un formulario v1 publicado no conoce esta propiedad. |
| Si al cambiar de tipo el valor por defecto no sobrevive, **no** se desmarca "Solo lectura" | Desmarcarlo a espaldas del autor sería peor que mostrarle el error; el editor reporta "Un campo obligatorio de solo lectura necesita un valor por defecto" y él decide. |

Las tres primeras las verifica el contrato al guardar y el editor antes de guardar.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Propiedad en el esquema | `packages/form-contracts/src/index.ts` (`formFieldSchema.readOnly`) |
| Reglas de compatibilidad | `packages/form-contracts/src/field-rules.ts` (`READ_ONLY_UNSUPPORTED_FIELD_TYPES`, `isFieldReadOnly`) |
| Garantía en el envío | `packages/form-contracts/src/validation.ts` (`applyReadOnlyDefaults`) |
| Casilla en el editor | `apps/web/src/features/cms/ui/field-editor.tsx` |
| Bloqueo por control | `apps/form-remote/src/features/runtime/ui/fields/common-props.ts` |
| Recorrido completo | `tests/e2e/authoring-journey.spec.ts` |

## Historial de cambios

- **2026-08-20** — Se agregó la funcionalidad: propiedad `readOnly` en el contrato, casilla en el editor (incluidas columnas de grilla), bloqueo diferenciado por tipo de control en el runtime, y sustitución del valor recibido por el declarado en la validación del envío.
- **2026-08-22** — La exigencia de `defaultValue` pasó a cubrir también la obligatoriedad condicional: antes solo miraba la fija, así que un campo de solo lectura con obligatoriedad condicional se podía publicar y quedaba imposible de completar cuando la condición se cumplía.
