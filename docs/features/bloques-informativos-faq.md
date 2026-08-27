# Bloques informativos FAQ

> **Mantené este documento al día.** Si cambiás la forma del bloque, dónde se renderiza o si el contenido pasa a admitir Markdown/HTML, actualizá este documento y sumá una línea al historial del final, en el mismo cambio que toca el código.

## Qué resuelve

Mostrar preguntas frecuentes, aclaraciones o instrucciones dentro de un formulario, como acordeones que la persona abre y cierra por su cuenta. No piden datos: son contenido de ayuda.

## Cómo funciona

Un bloque FAQ vive a **nivel de formulario** (`FormDefinition.faqBlocks`), no dentro de un contenedor. El orden entre bloques es el orden del arreglo, igual que contenedores y campos.

```json
{
  "faqBlocks": [
    { "id": "faq-1", "question": "¿Qué documentación necesito?", "answer": "El DNI y el comprobante de domicilio.", "initiallyOpen": false }
  ]
}
```

En el runtime se renderizan todos juntos, en una sección "Preguntas frecuentes" ubicada **antes** de los contenedores del formulario (a modo de ayuda previa a completar los campos).

### Configuración

| Campo | Qué hace |
| --- | --- |
| Pregunta / título | Encabezado del acordeón. Obligatorio. |
| Respuesta / contenido | Cuerpo mostrado al abrir el acordeón. Obligatorio. |
| Abierto por defecto | Si está marcado, el bloque arranca expandido en el runtime. |
| Orden | Implícito en la posición del bloque en la lista; se reordena con las flechas del editor. |

El CMS permite agregar, editar, eliminar y reordenar bloques desde una sección propia ("Preguntas Frecuentes (FAQ)") en el editor de estructura, separada de los contenedores.

### Contenido: texto plano, no Markdown ni HTML

**Decisión tomada:** el contenido de pregunta y respuesta es texto plano. No se interpreta Markdown ni HTML.

Motivo: admitir HTML requeriría sanitizar antes de renderizar (superficie de XSS) y Markdown requeriría una librería de parseo + sanitización adicional; hoy no hay un caso de uso concreto que lo justifique. Si aparece esa necesidad, el punto único a tocar es el renderizado de `block.answer` en `FaqAccordion` (hoy un `<p>` con `white-space: pre-wrap`, que ya respeta saltos de línea del texto plano).

## Reglas

| Regla | Dónde se verifica |
| --- | --- |
| Pregunta y respuesta no pueden estar vacías | Contrato (`faqBlockSchema`) y editor |
| No participan de la validación de campos (no tienen `fieldName`, no se pueden referenciar desde condiciones) | Editor — no existen en `otherFields`/`candidateIds` |
| No se incluyen en el payload de la submission | Contrato — `flattenFields` y `cleanSubmissionPayload` no recorren `faqBlocks` |
| No cuentan para la completitud estructural de un contenedor | Contrato — son de nivel formulario, no de contenedor; un formulario sigue necesitando al menos un contenedor con contenido real para poder publicarse |

## Accesibilidad del acordeón

Cada bloque es un `<button>` nativo con `aria-expanded` (estado actual) y `aria-controls` (apunta al panel), envuelto en un `<h3>` para navegación por encabezados. El panel usa `role="region"` y `aria-labelledby` hacia el botón.

Al ser un `<button>` nativo, Enter y Espacio lo activan sin código adicional, y el foco visible sigue el estilo del resto del runtime.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema del bloque | `packages/form-contracts/src/index.ts` (`faqBlockSchema`) |
| Mutaciones en el editor (agregar/quitar/mover/actualizar) | `apps/web/src/features/cms/model/definition.ts` |
| Validación previa al guardado | `apps/web/src/features/cms/model/editor-validation.ts` (`faqBlockErrorsFor`) |
| Edición en el CMS | `apps/web/src/features/cms/ui/faq-block-editor.tsx`, integrado en `definition-editor.tsx` |
| Renderizado como acordeón | `apps/form-remote/src/features/runtime/ui/faq/faq-accordion.tsx`, montado en `dynamic-form.tsx` |
| Tests | `packages/form-contracts/src/index.test.ts`, `apps/web/src/features/cms/model/definition.test.ts`, `apps/web/src/features/cms/model/editor-validation.test.ts`, `apps/web/src/features/cms/ui/definition-editor.test.tsx`, `apps/form-remote/src/features/runtime/ui/faq/faq-accordion.test.tsx` |

## Historial de cambios

- **2026-08-24** — Se agregaron los bloques informativos FAQ: CRUD y reordenamiento desde el CMS, renderizado como acordeones accesibles en el runtime, sin participar de la validación de campos ni del payload de la submission. Contenido en texto plano (ver sección "Contenido").
