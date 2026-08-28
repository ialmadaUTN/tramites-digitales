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

### Distribución en columnas

Cada contenedor (sección o grilla) elige entre **1, 2, 3 o 4 columnas** (`container.columns`). El runtime (`apps/form-remote`) las renderiza como una grilla CSS con esa cantidad de columnas iguales, vía la clase `columns-N` en `apps/form-remote/src/features/runtime/ui/dynamic-form.tsx`. La Vista Previa del CMS usa el mismo componente y el mismo CSS (`apps/form-remote/src/styles.css`) — no hay una implementación de grilla separada para el editor.

**Span de cada campo**, según su `width`:

| `width` | `grid-column` | Efecto |
| --- | --- | --- |
| `full` (default) | `1 / -1` | Ocupa toda la fila, sin importar cuántas columnas tenga el contenedor. |
| `half` | `span 1` | Ocupa una de las N columnas del contenedor. Con 2 columnas es literalmente la mitad; con 3 o 4 es un tercio o un cuarto — "respeta la distribución disponible" en vez de forzar un 50% fijo. |

Cuando hay más campos que columnas, el navegador los acomoda solo en la fila siguiente (comportamiento nativo de CSS Grid con `grid-auto-flow` por defecto): no hace falta lógica adicional para el wrap.

**Breakpoints y ancho mínimo.** Cada columna necesita ~200px para que sus controles no se vean apretados; con el gap de 18px entre columnas eso da un umbral de ~854px para 4 columnas y ~618px para 3. Por eso:

| Ancho de pantalla | 3 o 4 columnas configuradas | 2 columnas configuradas | 1 columna configurada |
| --- | --- | --- | --- |
| > 900px | Se muestran tal cual (3 o 4) | 2 | 1 |
| ≤ 900px | Se reducen a 2 | 2 | 1 |
| ≤ 640px | 1 (todo apilado) | 1 | 1 |

Las columnas usan `minmax(0, 1fr)` en vez de un mínimo fijo en píxeles: eso deja que la columna se achique junto con la pantalla en lugar de desbordar y generar scroll horizontal. El breakpoint de 640px es el mismo que ya colapsa el resto de `.dynamic-form` (padding, tamaño de título) a su versión mobile.

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

- **Obligatoriedad** (también en cada columna de una grilla). Es fija o condicional, nunca las dos: ver [Lógica condicional](logica-condicional.md#compatibilidad-con-la-obligatoriedad-fija).
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

### Completitud estructural: bloquea publicar, no guardar

Hay un segundo nivel de validación con una severidad distinta. Los problemas de arriba son **definiciones mal hechas** y bloquean el guardado. La completitud estructural es otra cosa: un borrador es trabajo a medias por definición, así que **se guarda igual** y lo que queda bloqueado es publicarlo.

| Regla | Mensaje | Dónde se marca |
| --- | --- | --- |
| El formulario necesita al menos un contenedor | El formulario debe tener al menos un contenedor | Estado vacío del editor |
| Una sección necesita al menos un campo | El contenedor debe tener al menos un campo | El contenedor específico |
| Una grilla repetible necesita al menos una columna | La grilla necesita al menos una columna | El contenedor específico |

`collectDefinitionEditorErrors` devuelve las dos severidades por separado: `hasErrors` (bloquea guardar) y `canPublish` (bloquea publicar). El botón **Publicar** queda deshabilitado con el motivo en el tooltip.

Las reglas viven en `packages/form-contracts/src/structural-validation.ts` y el editor las consume desde ahí, así que el mensaje que ve el autor es el mismo que devolvería el BFF. Del lado del servidor, `publish()` valida contra `publishableFormDefinitionSchema` y responde 400 sin crear la versión; `updateDraft()` sigue usando el esquema base.

**Por qué son dos esquemas y no una regla más en el base:** `formDefinitionSchema` también valida las **lecturas** — `list()` lo corre por cada formulario. Si rechazara definiciones incompletas, un único borrador vacío ya guardado dejaría al CMS sin listado y sin forma de entrar a arreglarlo.

**Contenedores solo informativos:** hoy todos los tipos de campo son de entrada, así que "tener contenido" es "tener al menos un campo". Si en el futuro aparecen componentes informativos **dentro de un contenedor**, uno que solo los tenga se considerará válido; el único lugar a tocar sería `hasContent` en `structural-validation.ts`. Los bloques FAQ ya implementados no entran en este caso: viven a nivel de formulario, no de contenedor — ver [Bloques informativos FAQ](bloques-informativos-faq.md).
| Condiciones incompletas o mal apuntadas | Ver [Lógica condicional](logica-condicional.md) |
| Obligatoriedad fija y condicional a la vez | Un campo obligatorio no puede tener además obligatoriedad condicional: dejá solo una de las dos |
| Variables externas, plantillas o bloques incompatibles | La variable no está declarada, el placeholder es inválido, el tipo no coincide o el bloque se usa dentro de una grilla |
| Grilla sin columnas o con filas inconsistentes | Ver [Grillas repetibles](grillas-repetibles.md) |

El BFF revalida todo contra el contrato al guardar: el editor adelanta el diagnóstico, no lo reemplaza.

## Vista JSON

Junto a "Estructura" y "Vista Previa", el workspace tiene una tercera pestaña **"JSON"** (`apps/web/src/features/cms/ui/json-preview-panel.tsx`) con una vista de solo lectura de la definición tal como se normalizaría y guardaría en el BFF.

- **Normalización real, no un espejo del formulario en pantalla.** El panel corre `formDefinitionSchema.safeParse(definition)` — el mismo esquema que valida el BFF — y muestra `parsed.data`. Por eso trae aplicados los valores por defecto (`columns`, `width`, `rules: {}`, etc.) aunque no se hayan tocado en el editor, y nunca puede filtrar una clave que el contrato no declare (ver [restricciones conocidas](#restricciones-conocidas) para el resto de lo que el editor no expone).
- **Formateado e indentado**, y se **actualiza en vivo**: es un componente controlado por la misma `definition` que edita "Estructura", así que cualquier cambio de campos, reglas, condiciones o contenedores se ve reflejado en el próximo render.
- **Copiar** copia el JSON completo al portapapeles (`navigator.clipboard.writeText`) y confirma con un badge "¡Copiado!" durante 2 segundos.
- **Errores de validación**, en un cartel arriba del JSON (`role="alert"`), reutilizando los mismos mensajes que ya ve el autor en "Estructura" (`collectDefinitionEditorErrors`) más `editorErrors.structure` — la completitud estructural (p. ej. un formulario sin contenedores) también se avisa acá, porque `formDefinitionSchema` acepta `containers: []` y sin este aviso el panel se quedaría mudo justo cuando Publicar está bloqueado por esa razón. Si el schema falla por algo que el editor no marcó (caso raro: ver por ejemplo el título de más de 200 caracteres, que el editor no chequea por longitud), el panel recurre como último recurso a los issues crudos de Zod para no quedarse en silencio. Con el schema roto, igual se muestra el mejor esfuerzo posible del JSON (`definition` sin normalizar) en vez de dejar el panel en blanco.
- **Solo lectura a propósito**, en esta primera versión: es un `<pre>`, no hay ningún control para editar el JSON desde acá.

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
| Completitud estructural | `packages/form-contracts/src/structural-validation.ts` |
| Editor de campo | `apps/web/src/features/cms/ui/field-editor.tsx` |
| Distribución en columnas y su CSS responsive | `apps/form-remote/src/features/runtime/ui/dynamic-form.tsx`, `apps/form-remote/src/styles.css` |
| Vista JSON de solo lectura | `apps/web/src/features/cms/ui/json-preview-panel.tsx` |
| Tablas de reglas (tests) | `packages/form-contracts/src/rules.test.ts` |

## Historial de cambios

- **2026-08-28** — Se agregó al workspace una pestaña "JSON" de solo lectura con la definición normalizada (mismo `formDefinitionSchema` que el BFF), que se actualiza en vivo, permite copiar el contenido e informa los errores de validación con los mismos mensajes que "Estructura" — incluida la completitud estructural, que el esquema base por sí solo no rechaza. Detalle en [Vista JSON](#vista-json).
- **2026-08-21** — El E2E de autoría limpia el formulario creado y sus dependencias al finalizar para no acumular datos de prueba publicados.
- **2026-08-20** — Se agregaron campos de solo lectura, reglas de longitud en todos los tipos de texto, mensajes de error de formato y de tipo, obligatoriedad configurable en columnas de grilla, editor de condiciones con reglas múltiples y todos los operadores, validación de catálogos y de valores por defecto, y validación previa al guardado para regex, duplicados, rangos, máscaras y parámetros no enteros.
- **2026-08-20** — Se retiró del CMS la acción para crear nuevas grillas repetibles; las grillas existentes siguen siendo editables.
- **2026-08-20** — El ciclo de autoría suma la pausa: un formulario publicado se puede sacar de circulación y reactivar desde el encabezado del workspace, y el listado lo rotula como "Pausado". Detalle en [pausa de formularios](pausa-de-formularios.md).
- **2026-08-20** — Se agregó la validación de completitud estructural (formulario sin contenedores, contenedor sin campos, grilla sin columnas) como un nivel aparte del esquema base: bloquea publicar pero no guardar, porque un borrador es trabajo a medias. `collectDefinitionEditorErrors` devuelve ahora `canPublish` además de `hasErrors`, y el BFF valida `publish()` contra `publishableFormDefinitionSchema`. Se definió que un contenedor con solo componentes informativos será válido cuando esos componentes existan.
- **2026-08-24** — Se agregaron bloques informativos FAQ a nivel de formulario (no de contenedor): CRUD y reordenamiento desde el CMS, acordeones accesibles en el runtime, sin participar de la validación de campos ni del payload. Detalle en [Bloques informativos FAQ](bloques-informativos-faq.md).
- **2026-08-25** — Cambiar de formulario en la lista sin haber guardado ya no descarta lo que se estaba editando: `useCmsWorkspace` guarda en memoria el nombre y la definición de cada formulario que se deja a medio editar, y los restaura si se vuelve a seleccionar. Se descarta recién cuando se guarda el borrador (ahí ya coincide con el servidor) o al recargar la página.
- **2026-08-25** — La distribución en columnas de un contenedor pasó de admitir 1 o 2 a admitir 1, 2, 3 o 4. Se agregaron breakpoints intermedios (900px baja 3-4 columnas a 2; 640px las baja todas a 1) para que ninguna columna quede más angosta que el mínimo cómodo (~200px) ni aparezca scroll horizontal. El span de cada campo (`full`/`half`) no cambió: `full` sigue ocupando toda la fila y `half` sigue ocupando una de las N columnas, sea cual sea N.
- **2026-08-20** — Se agregó la validación de completitud estructural (formulario sin contenedores, contenedor sin campos, grilla sin columnas) como un nivel aparte del esquema base: bloquea publicar pero no guardar, porque un borrador es trabajo a medias. `collectDefinitionEditorErrors` devuelve ahora `canPublish` además de `hasErrors`, y el BFF valida `publish()` contra `publishableFormDefinitionSchema`.
- **2026-08-21** — Se agregó la autoría v3 de variables externas, condiciones jerárquicas, exclusión independiente y bloques informativos ordenados; los formularios v1/v2 se migran a v3 al abrirse en el CMS sin alterar la versión publicada.
- **2026-08-21** — La vista previa del CMS incorporó un panel de contexto tipado para probar variables externas y mostrar el estado efectivo y el payload limpio sin enviar esos valores al servidor.
- **2026-08-21** — Los bloques informativos incorporaron plantillas dinámicas seguras, validación de referencias externas y reordenamiento dentro de la secuencia de campos.
- **2026-08-21** — La completitud estructural pasó a leer `items`: una sección con solo bloques informativos es contenido válido y se puede publicar, que era la decisión que quedó tomada cuando esos bloques todavía no existían.
