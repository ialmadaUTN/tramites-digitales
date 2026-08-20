# Grillas repetibles

> **Mantené este documento al día.** Si cambiás los tipos permitidos como columna, los límites de filas o la forma del payload, actualizá este documento y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Pedir una cantidad variable de ítems del mismo tipo: los siniestros previos, los conductores autorizados, los bienes denunciados. La persona agrega y quita filas, y cada fila tiene las mismas columnas.

Sin esto habría que publicar N campos fijos ("Siniestro 1", "Siniestro 2"…) y esperar que alcancen.

## Cómo funciona

Una grilla es un **contenedor** con `kind: 'repeater'`. Sus campos no son campos sueltos del formulario: son las **columnas** de la fila.

A diferencia de una sección normal, la grilla declara su propio `fieldName`, y todo su contenido viaja bajo esa única clave del payload:

```json
{
  "previousClaims": [
    { "date": "2025-03-01", "amount": 1200 },
    { "date": "2025-07-14", "amount": 800 }
  ]
}
```

Cada objeto del arreglo es una fila; sus claves son los `fieldName` de las columnas.

### Configuración

Las grillas ya presentes en una definición se pueden editar desde el CMS. La acción para crear una grilla repetible nueva no está disponible en el editor.

| Opción | Qué hace |
| --- | --- |
| Clave de payload | `fieldName` de la grilla. Comparte espacio de nombres con los campos sueltos del formulario: no puede repetirse con ninguno. |
| Mínimo de filas | Cuántas filas se exigen. Con mínimo mayor a cero, el runtime arranca con esa cantidad ya creada y no deja bajar de ahí. |
| Máximo de filas | Tope, hasta 50. El botón de agregar se deshabilita al alcanzarlo. |
| Columnas | Se configuran una por una, igual que un campo suelto. |

Los `fieldName` de las columnas solo tienen que ser únicos **dentro de su grilla**: dos grillas distintas pueden tener ambas una columna `monto`, y una columna puede llamarse igual que un campo suelto sin conflicto.

### Configuración por columna

Cada columna admite lo mismo que un campo suelto de su tipo: etiqueta, clave, valor por defecto acorde al tipo, máscara, reglas de longitud o rango, expresión regular, mensajes de error propios, **obligatoriedad** y **solo lectura**.

La obligatoriedad se evalúa **por fila**: si la columna es obligatoria, cada fila cargada debe tenerla completa, y el error se muestra en la celda concreta. En el encabezado de la grilla, las columnas obligatorias llevan un asterisco.

### Tipos de columna permitidos

`text`, `email`, `phone`, `alphabetic`, `alphanumeric`, `number`, `date`, `time`, `checkbox`, `radio`, `select`, `combobox`.

Quedan **fuera** a propósito, alineado con el alcance definido:

| Excluido | Motivo |
| --- | --- |
| `textarea` | Texto largo dentro de una celda vuelve la grilla ilegible. |
| `multiselect` | Una celda con múltiples valores rompe la forma plana de la fila. |
| `fileUpload` | Los adjuntos se manejan a nivel formulario, no por fila. |
| Grillas anidadas | Fuera de alcance. |

## Reglas

| Regla | Dónde se verifica |
| --- | --- |
| Requiere `schemaVersion: 2` | Contrato |
| Requiere `fieldName` | Contrato y editor |
| Necesita al menos una columna | Editor |
| El mínimo de filas no puede superar el máximo | Contrato y editor |
| Máximo de filas entre 1 y 50, en números enteros | Editor |
| Las celdas **no** admiten lógica condicional | Contrato y editor — ver [Lógica condicional](logica-condicional.md) |
| Ids y claves de columna únicos dentro de la grilla | Contrato |
| La clave de la grilla no puede repetir la de un campo suelto | Contrato y editor |

## Validación del envío

`validateRepeater` (`packages/form-contracts/src/validation.ts`) verifica que el valor sea una lista de filas válidas, que la cantidad respete mínimo y máximo, y que cada celda cumpla las reglas de su columna. Los errores se reportan con la ruta completa (`previousClaims.0.amount`), y el runtime los muestra en la celda correspondiente.

Si la grilla exige un mínimo y no llegó ninguna fila, el error se reporta a nivel de la grilla.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema del contenedor | `packages/form-contracts/src/index.ts` (`formContainerSchema`) |
| Tipos permitidos como columna | `packages/form-contracts/src/field-rules.ts` (`REPEATER_FIELD_TYPES`) |
| Validación del envío | `packages/form-contracts/src/validation.ts` (`validateRepeater`) |
| Configuración en el editor | `apps/web/src/features/cms/ui/definition-editor.tsx` |
| Renderizado y filas | `apps/form-remote/src/features/runtime/ui/repeater/dynamic-repeater.tsx` |
| Tests de reglas | `packages/form-contracts/src/evaluation.test.ts` |

## Historial de cambios

- **2026-08-20** — Se habilitó configurar la obligatoriedad por columna desde el CMS (antes el editor la ocultaba en las celdas, aunque el contrato y el validador ya la soportaban). Se agregaron validación inmediata de mínimo y máximo de filas, marca de columna obligatoria en el encabezado, error por celda con resalte, y control del valor por defecto según el tipo de cada columna.
- **2026-08-20** — Se retiró del CMS la acción para crear nuevas grillas repetibles; las grillas existentes siguen siendo editables.
