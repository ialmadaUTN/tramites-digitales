import type { FormContainer, FormDefinition } from './index.js';

/**
 * Completitud estructural: que el formulario tenga con qué funcionar.
 *
 * Es un nivel aparte del esquema base a propósito. El esquema base se usa
 * también para **leer** (`list`, `getDraft`, `runtime` en modo borrador), así
 * que si rechazara definiciones incompletas, un único borrador vacío ya
 * guardado tiraría abajo el listado entero del CMS y no habría forma de entrar
 * a arreglarlo. Estas reglas se aplican al **publicar**, no al guardar: un
 * borrador es trabajo a medias por definición.
 *
 * Vive en su propio subpath —igual que `field-rules`— porque el editor corre
 * sobre Turbopack, que no resuelve los especificadores `.js` que exige
 * NodeNext en el resto del paquete. Este módulo no tiene imports de valor
 * relativos: los `import type` se borran al compilar.
 */

export const EMPTY_FORM_MESSAGE = 'El formulario debe tener al menos un contenedor';
export const EMPTY_CONTAINER_MESSAGE = 'El contenedor debe tener al menos un campo';
export const EMPTY_REPEATER_MESSAGE = 'La grilla necesita al menos una columna';

export type StructuralIssue = {
  /** Contenedor al que hay que anclar el error en el editor. Ausente si el problema es del formulario. */
  containerId?: string;
  /** Ruta dentro de la definición, para que el BFF reporte dónde está el problema. */
  path: (string | number)[];
  message: string;
};

/**
 * Qué cuenta como contenido válido de un contenedor.
 *
 * Se mira `items`, no `fields`: en v3 una sección guarda campos y bloques
 * informativos mezclados en `items`, y `fields` quedó como proyección legacy.
 * Una sección con **solo bloques informativos** es contenido válido y se puede
 * publicar — la decisión estaba tomada desde antes de que los bloques
 * existieran, y esta función es el único lugar que la aplica.
 *
 * Es la misma proyección que `containerItems` de `field-rules`, replicada acá
 * en dos líneas: importarla obligaría a resolver un especificador `.js`
 * relativo, que es justo lo que Turbopack no resuelve en el CMS.
 */
function hasContent(container: FormContainer): boolean {
  return (container.items ?? container.fields).length > 0;
}

export function structuralIssues(definition: FormDefinition): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  if (definition.containers.length === 0) {
    issues.push({ path: ['containers'], message: EMPTY_FORM_MESSAGE });
    return issues;
  }

  definition.containers.forEach((container, index) => {
    if (hasContent(container)) return;
    issues.push({
      containerId: container.id,
      path: ['containers', index, 'fields'],
      // Una grilla no tiene "campos" sino columnas: el mensaje tiene que hablar
      // el idioma de lo que el autor ve en pantalla.
      message: container.kind === 'repeater' ? EMPTY_REPEATER_MESSAGE : EMPTY_CONTAINER_MESSAGE,
    });
  });

  return issues;
}
