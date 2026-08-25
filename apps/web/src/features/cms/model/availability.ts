/**
 * Cómo se rotula el estado de un formulario en el listado del CMS.
 *
 * La precedencia es la regla: pausado gana sobre publicado. Un formulario pausado
 * conserva su versión publicada, así que mostrarlo como "Publicado" haría creer
 * que sigue disponible en el portal, que es justo lo contrario de lo que pasa.
 */
export type AvailabilityState = { published: boolean; paused: boolean };

export type AvailabilityBadge = { label: string; className: string };

export function availabilityBadge({ published, paused }: AvailabilityState): AvailabilityBadge {
  if (paused) return { label: 'Pausado', className: 'badge-danger' };
  if (published) return { label: 'Publicado', className: 'badge-success' };
  return { label: 'Borrador', className: 'badge-warning' };
}
