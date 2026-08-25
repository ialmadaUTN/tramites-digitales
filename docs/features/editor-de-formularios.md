# Editor de formularios (CMS)

> **Mantené este documento al día.** Si cambiás un tipo de campo, una regla, un límite o un mensaje, actualizá la sección correspondiente y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Permite a una persona de negocio armar un formulario de trámite sin escribir código: definir qué campos pide, cómo se validan, cómo se llama cada clave del payload que va a recibir Dynamics, y publicarlo para que cualquier portal lo cargue por ID.

## Cómo funciona

El formulario vive como una **definición JSON** que atraviesa cuatro piezas:

| Pieza | Rol |
| --- | --- |
| `packages/form-contracts` | Define qué es una definición válida y qué es un envío válido. Es la fuente de verdad; el CMS y el BFF validan contra el mismo esquema. |
| `apps/web` (CMS) | Edita la definición y la valida **antes** de guardarla, para que el autor vea el problema junto al campo. |
| `apps/bff` | Persiste borradores, publica versiones y valida cada envío contra la versión publicada. |
| `apps/form-remote` | Renderiza la definición publicada como formulario real, cargado por Module Federation. |

Flujo de autoría: crear → editar → **Guardar** (borrador) → **Publicar** (versión inmutable). El host consume siempre la última versión publicada; la vista previa del CMS consume el borrador.

Una vez publicado, el formulario se puede sacar de circulación sin despublicarlo: ver [pausa de formularios](pausa-de-formularios.md). Publicar una versión nueva no reactiva un formulario pausado, y la vista previa del borrador sigue funcionando aunque lo esté.

Los recorridos E2E que crean formularios (`tests/e2e/authoring-journey.spec.ts` y `tests/e2e/form-flow.spec.ts`) usan formularios reales para verificar el CMS y la cadena CMS → BFF → Supabase → host. Cada `afterEach` registra el ID desde el momento de la creación y elimina sus submissions, los uploads cuando el schema REST los expone y el formulario al terminar, incluso si una aserción posterior falla; las versiones publicadas se eliminan por cascade de la base.

### Estructura

Una definición tiene **contenedores**, y cada contenedor tiene campos o ítems informativos ordenados. Un contenedor puede ser una sección normal (`kind: 'section'`) o una [grilla repetible](grillas-repetibles.md) (`kind: 'repeater'`). Los bloques informativos se describen en [Bloques informativos](bloques-informativos.md). El CMS permite editar grillas repetibles que ya existen en una definición, pero no ofrece una acción para crear una nueva.

Cada campo aporta una clave al payload final mediante su `fieldName`, que debe ser un identificador simple (empieza con letra o `_`, solo letras, números y `_`) y único dentro de su ámbito.

### Versiones de esquema

- **v1**: formato original, sigue soportado para lo ya publicado.
- **v2**: requiere `tipificationKey` y habilita `email`, `phone`, `alphabetic`, `alphanumeric`, `multiselect`, `fileUpload`, máscaras, `allowCustomValue`, campos de solo lectura y grillas repetibles.
- **v3**: conserva las capacidades de v2 y agrega variables externas, condiciones jerárquicas, inclusión independiente y bloques informativos.

El CMS sigue leyendo definiciones v1/v2 publicadas y, al abrirlas, las migra a v3 en memoria (proyectando los campos previos a `items`); lo publicado no se toca hasta el próximo guardado.

## Tipos de campo y qué admite cada uno

| Tipo | Longitud | Rango numérico | Máscara | Catálogo | Solo lectura | En grilla |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `text` | ✓ | | ✓ | | ✓ | ✓ |
| `textarea` | ✓ | | | | ✓ | |
| `email` | ✓ | | | | ✓ | ✓ |
| `phone` | ✓ | | ✓ | | ✓ | ✓ |
| `alphabetic` | ✓ | | | | ✓ | ✓ |
| `alphanumeric` | ✓ | | | | ✓ | ✓ |
| `number` | | ✓ | | | ✓ | ✓ |
| `date` | | | | | ✓ | ✓ |
| `time` | | | | | ✓ | ✓ |
| `checkbox` | | | | | ✓ | ✓ |
| `select` | | | | ✓ | ✓ | ✓ |
| `radio` | | | | ✓ | ✓ | ✓ |
| `combobox` | | | | ✓ | ✓ | ✓ |
| `multiselect` | | | | ✓ | ✓ | |
| `fileUpload` | | | | | | |

Las listas viven en `packages/form-contracts/src/field-rules.ts` y el CMS las reexporta desde `apps/web/src/features/cms/model/constants.ts`, para que el editor no pueda ofrecer algo que el contrato después rechaza.

### Máscaras

Se normaliza a dígitos antes de validar y de persistir, y se muestra formateado.

| Máscara | Tipos compatibles | Regla |
| --- | --- | --- |
| `phone_ar` | `text`, `phone` | 8 a 15 dígitos |
| `dni_ar` | `text` | 7 u 8 dígitos |
| `cuit_ar` | `text` | 11 dígitos |
| `cbu` | `text` | 22 dígitos |

La compatibilidad está en `MASK_COMPATIBILITY`; el editor solo ofrece las máscaras válidas para el tipo elegido.

### Catálogos de opciones

`select`, `radio`, `combobox` y `multiselect` requieren al menos una opción. Cada opción tiene **etiqueta visible** y **valor interno** (el que viaja en el payload).

El editor marca por fila las opciones sin etiqueta, sin valor o con valor repetido, y bloquea el guardado.

`combobox` declara además `allowCustomValue`:
- `true`: acepta texto fuera del listado.
- `false` (estricto): solo valores del catálogo, verificado también en el envío.

### Valores por defecto

Se eligen según el tipo, no como texto libre:
- Catálogo (`select`, `radio`, `multiselect`, `combobox` estricto): se seleccionan del catálogo.
- `checkbox`: marcado / sin marcar.
- `number`, `date`, `time`: control del tipo correspondiente.
- Resto: texto libre.

Al cambiar el tipo de un campo, el valor por defecto se conserva **solo si sigue siendo representable** en el tipo nuevo; si no, se descarta junto con las reglas incompatibles (`changeFieldType` en `apps/web/src/features/cms/model/definition.ts`).

### Archivos adjuntos

`fileUpload` acepta entre 1 y 5 archivos, de tipos PDF, JPG y PNG, hasta 10 MB cada uno. Los tipos permitidos se eligen en el editor. No admite valor por defecto ni solo lectura.

## Reglas de validación configurables

Por campo se puede configurar:

- **Obligatoriedad** (también en cada columna de una grilla).
- **Longitud** mínima y máxima, en los tipos de texto.
- **Rango numérico** mínimo y máximo, en `number`.
- **Expresión regular**.
- **Mensajes de error propios** para: obligatorio, mínimo/máximo de caracteres, mínimo/máximo numérico, formato inválido (cubre tanto el formato nativo del tipo como la regex) y tipo de dato incorrecto.

El catálogo de variables externas se configura por formulario. Cada variable declara tipo (`string`, `number`, `boolean`) y confianza (`presentation` o `trusted`). El editor solo permite usar una variable de presentación en la visibilidad de un bloque informativo; cualquier condición que afecte datos requiere contexto firmado del host. El host de demostración firma ese contexto en el servidor; el secreto se configura como `FORM_CONTEXT_JWT_SECRET` y nunca se expone al navegador.

Los bloques informativos también pueden interpolar esas variables en el título y el contenido con `{{nombre}}`. La referencia debe existir en el catálogo; el renderer recibe el valor desde `DynamicFormProps.externalVariables`, incluso para variables `trusted`, porque el bloque no participa de autorización ni del payload. Si un bloque visible no recibe un valor útil, el renderer muestra un error general y notifica `MISSING_EXTERNAL_VARIABLE`; los bloques ocultos no se resuelven.

La vista previa interactiva incluye el panel **Contexto de prueba** (`apps/web/src/features/cms/ui/preview-context-panel.tsx`). Allí se pueden asignar o quitar valores con controles acordes al tipo, distinguir variables `trusted` de `presentation`, restablecer el contexto y consultar el JSON de props que recibe `DynamicForm`. El renderer informa el estado efectivo (visible, habilitado e incluido) y el payload simulado, por lo que un valor oculto o excluido se ve inmediatamente como ausente. El panel es exclusivamente local: no firma el contexto, no cambia el borrador y no otorga autorización.

## Validación previa al guardado

El editor reproduce las reglas del contrato y muestra el error **junto al campo**, bloqueando el guardado. `collectDefinitionEditorErrors` en `apps/web/src/features/cms/model/editor-validation.ts` cubre:

| Qué detecta | Mensaje |
| --- | --- |
| Regex que no compila | La expresión regular no es válida |
| Opciones duplicadas / sin etiqueta / sin valor | Valores de opción duplicados… · Hay opciones sin etiqueta visible · Hay opciones sin valor interno |
| Valor por defecto fuera del catálogo | El valor por defecto no está en el catálogo… |
| Longitud invertida, negativa o no entera | El mínimo de caracteres no puede superar el máximo · La longitud debe expresarse en números enteros |
| Rango numérico invertido o en tipo no numérico | El mínimo numérico no puede superar el máximo · Solo los campos numéricos admiten un rango |
| Máscara incompatible con el tipo | `<máscara>` no es compatible con el tipo `<tipo>` |
| Archivos: cantidad fuera de rango o no entera | Se admiten entre 1 y 5 archivos |
| Solo lectura mal configurado | Ver [Campos de solo lectura](campos-de-solo-lectura.md) |
| Claves de payload duplicadas o inválidas | Este nombre de clave ya se usa en otro campo |
| Condiciones incompletas o mal apuntadas | Ver [Lógica condicional](logica-condicional.md) |
| Variables externas, plantillas o bloques incompatibles | La variable no está declarada, el placeholder es inválido, el tipo no coincide o el bloque se usa dentro de una grilla |
| Grilla sin columnas o con filas inconsistentes | Ver [Grillas repetibles](grillas-repetibles.md) |

El BFF revalida todo contra el contrato al guardar: el editor adelanta el diagnóstico, no lo reemplaza.

## Restricciones conocidas

- Los `<label>` del editor no están asociados a sus controles (`htmlFor`), así que los tests consultan por grupo. Es deuda de accesibilidad pendiente.
- Al crear un formulario, el editor se muestra antes de que termine de cargar el borrador; lo que se escriba en esa ventana se pierde.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema de la definición | `packages/form-contracts/src/index.ts` |
| Listas y chequeos compartidos con el CMS | `packages/form-contracts/src/field-rules.ts` |
| Validación de envíos | `packages/form-contracts/src/validation.ts` |
| Mutaciones de la definición | `apps/web/src/features/cms/model/definition.ts` |
| Migración v1/v2 al abrir el CMS | `packages/form-contracts/src/migrations.ts` (`upgradeDefinitionToV3`, reexportada por `index.ts`) |
| Validación previa al guardado | `apps/web/src/features/cms/model/editor-validation.ts` |
| Editor de campo | `apps/web/src/features/cms/ui/field-editor.tsx` |
| Tablas de reglas (tests) | `packages/form-contracts/src/rules.test.ts` |

## Historial de cambios

- **2026-08-21** — El E2E de autoría limpia el formulario creado y sus dependencias al finalizar para no acumular datos de prueba publicados.
- **2026-08-20** — Se agregaron campos de solo lectura, reglas de longitud en todos los tipos de texto, mensajes de error de formato y de tipo, obligatoriedad configurable en columnas de grilla, editor de condiciones con reglas múltiples y todos los operadores, validación de catálogos y de valores por defecto, y validación previa al guardado para regex, duplicados, rangos, máscaras y parámetros no enteros.
- **2026-08-20** — Se retiró del CMS la acción para crear nuevas grillas repetibles; las grillas existentes siguen siendo editables.
- **2026-08-20** — El ciclo de autoría suma la pausa: un formulario publicado se puede sacar de circulación y reactivar desde el encabezado del workspace, y el listado lo rotula como "Pausado". Detalle en [pausa de formularios](pausa-de-formularios.md).
- **2026-08-21** — Se agregó la autoría v3 de variables externas, condiciones jerárquicas, exclusión independiente y bloques informativos ordenados; los formularios v1/v2 se migran a v3 al abrirse en el CMS sin alterar la versión publicada.
- **2026-08-21** — La vista previa del CMS incorporó un panel de contexto tipado para probar variables externas y mostrar el estado efectivo y el payload limpio sin enviar esos valores al servidor.
- **2026-08-21** — Los bloques informativos incorporaron plantillas dinámicas seguras, validación de referencias externas y reordenamiento dentro de la secuencia de campos.
