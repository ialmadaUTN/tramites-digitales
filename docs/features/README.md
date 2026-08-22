# Documentación de funcionalidades

Un archivo por funcionalidad. Describen **qué hace el sistema y por qué**, no cómo está escrito el código.

## ⚠️ Esta documentación se mantiene junto con el código

**Si cambiás el comportamiento de una funcionalidad, actualizás su documento en el mismo cambio.** No es opcional ni es una tarea posterior: un documento desactualizado es peor que no tener documento, porque alguien lo va a creer.

Concretamente:

- **Cambiás una regla de validación, un límite o una combinación permitida** → actualizá la sección correspondiente y agregá una línea al historial de cambios del documento.
- **Agregás un tipo de campo, un operador o una opción de configuración** → agregalo a las tablas del documento que lo cubre.
- **Cambiás el nombre de un archivo o función referenciada** → corregí la referencia. Los documentos citan rutas reales para poder seguirse contra el código.
- **Implementás algo que ningún documento cubre** → creá el documento con la funcionalidad **completa**, no solo con tu cambio.

La regla completa está en [`AGENTS.md`](../../AGENTS.md) en la raíz del repositorio.

## Índice

| Documento | Cubre |
| --- | --- |
| [Editor de formularios](editor-de-formularios.md) | El CMS: tipos de campo, reglas de validación, catálogos de opciones, valores por defecto y la validación previa al guardado. |
| [Campos de solo lectura](campos-de-solo-lectura.md) | Campos visibles pero no editables, y cómo se garantiza su valor del lado del servidor. |
| [Lógica condicional](logica-condicional.md) | Visibilidad, habilitación y obligatoriedad condicionales entre campos. |
| [Bloques informativos](bloques-informativos.md) | Bloques de texto y visibilidad contextual dentro de una sección. |
| [Grillas repetibles](grillas-repetibles.md) | Contenedores de filas repetibles y sus columnas. |

## Qué no va acá

`docs/tramites-digitales-galicia.md` es el informe del kickoff técnico. Es contexto histórico del proyecto, no documentación de funcionalidad: no lo edites para registrar cambios.
