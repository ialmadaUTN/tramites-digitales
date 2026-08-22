import { describe, expect, it } from 'vitest';
import { assertFormAvailable, isPaused } from './form-availability';
import { FORM_PAUSED_MESSAGE } from './http-error';

// Tabla de la regla: lo que importa es qué rechaza. Cada fila que no tenga su
// caso negativo es una regla que puede desaparecer sin que nadie se entere.
const cases: Array<{ name: string; paused_at: string | null; paused: boolean }> = [
  { name: 'nunca pausado', paused_at: null, paused: false },
  { name: 'pausado', paused_at: '2026-08-20T22:00:00.000Z', paused: true },
  { name: 'reactivado (vuelve a null)', paused_at: null, paused: false },
];

describe('disponibilidad del formulario', () => {
  it.each(cases)('$name → paused=$paused', ({ paused_at, paused }) => {
    expect(isPaused({ paused_at })).toBe(paused);
  });

  it('deja pasar un formulario disponible', () => {
    expect(() => assertFormAvailable({ paused_at: null })).not.toThrow();
  });

  it('rechaza un formulario pausado con 409 y el mensaje exacto del ticket', () => {
    let thrown: unknown;
    try {
      assertFormAvailable({ paused_at: '2026-08-20T22:00:00.000Z' });
    } catch (error) {
      thrown = error;
    }

    // 409 y no 503: la pausa es un conflicto de estado de un recurso, no una caída del servicio.
    expect((thrown as { getStatus(): number }).getStatus()).toBe(409);
    expect((thrown as { getResponse(): unknown }).getResponse()).toEqual({
      code: 'FORM_PAUSED',
      message: 'Este formulario no está disponible en este momento',
    });
  });

  it('el mensaje que se muestra al cliente es el que exporta el BFF', () => {
    // Si alguien cambia el literal, este test lo agarra: el front no lo duplica.
    expect(FORM_PAUSED_MESSAGE).toBe('Este formulario no está disponible en este momento');
  });
});
