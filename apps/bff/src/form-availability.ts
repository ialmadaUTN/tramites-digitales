import { formPaused } from './http-error';

/**
 * Disponibilidad de un formulario. Es una regla de negocio, no orquestación de I/O:
 * vive fuera de `forms.service.ts` para poder testearse sin simular Supabase.
 *
 * La pausa es un eje independiente de la publicación. Un formulario pausado conserva
 * su versión publicada; lo que cambia es que el runtime deja de entregarla.
 */
export type FormAvailability = { paused_at: string | null };

export function isPaused(form: FormAvailability): boolean {
  return Boolean(form.paused_at);
}

/** Tira 409 FORM_PAUSED si el formulario está pausado. */
export function assertFormAvailable(form: FormAvailability): void {
  if (isPaused(form)) formPaused();
}
