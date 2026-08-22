# Bloques informativos

> **Mantené este documento al día.** Toda modificación del contrato, CMS o renderer que cambie los bloques informativos debe actualizar este documento y sumar una línea al historial.

## Qué resuelve

Permite insertar texto explicativo dentro de una sección del formulario, por ejemplo instrucciones, advertencias o información contextual. El bloque puede mostrarse según una variable de presentación del host y nunca genera datos ni validaciones.

## Cómo funciona

Las definiciones v3 guardan los hijos de una sección en `items`, preservando el orden entre campos y bloques. Las definiciones anteriores se proyectan a ítems de campo cuando se abren en el CMS.

| Capa | Responsabilidad |
| --- | --- |
| `packages/form-contracts/src/index.ts` | Define `textBlock`, su texto y su condición `visible`; valida que no tenga reglas de payload. |
| `apps/web/src/features/cms/ui/definition-editor.tsx` | Crea y edita el bloque dentro de una sección. |
| `apps/form-remote/src/features/runtime/ui/dynamic-form.tsx` | Renderiza el bloque solo cuando su condición se cumple. |
| `apps/bff` | Ignora los bloques durante la validación, limpieza y entrega de submissions. |

Los bloques solo admiten `visible`. No tienen `enabled`, `included`, `required`, `fieldName` ni valor persistible. Una variable externa marcada `presentation` puede controlar su visibilidad; una variable `trusted` también es válida, aunque no aporta autorización.

## Restricciones

- Solo se pueden agregar a secciones normales; las columnas de una grilla repetible siguen siendo campos.
- El texto debe ser no vacío y el título es opcional.
- Una condición de bloque no puede impedir ni exigir un campo.
- Los valores del bloque no se guardan en el payload ni se envían a Dynamics.

## Dónde mirar

| Qué | Dónde |
| --- | --- |
| Esquema | `packages/form-contracts/src/index.ts` (`textBlockSchema`, `formItemSchema`) |
| Mutaciones del CMS | `apps/web/src/features/cms/model/definition.ts` |
| Editor | `apps/web/src/features/cms/ui/definition-editor.tsx` |
| Runtime | `apps/form-remote/src/features/runtime/ui/dynamic-form.tsx` |

## Historial de cambios

- **2026-08-21** — Se incorporaron bloques de texto ordenados por sección, con visibilidad condicional y sin efecto sobre validación o payload.
