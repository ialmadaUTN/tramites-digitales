import { describe, expect, it } from 'vitest';
import { availabilityBadge } from './availability';

// Barrido exhaustivo: el espacio es de 2×2, así que no hay excusa para dejar
// una combinación sin fila. La que importa es publicado+pausado.
const cases: Array<{ published: boolean; paused: boolean; label: string; className: string }> = [
  { published: false, paused: false, label: 'Borrador', className: 'badge-warning' },
  { published: true, paused: false, label: 'Publicado', className: 'badge-success' },
  { published: true, paused: true, label: 'Pausado', className: 'badge-danger' },
  { published: false, paused: true, label: 'Pausado', className: 'badge-danger' },
];

describe('availabilityBadge', () => {
  it.each(cases)('published=$published paused=$paused → $label', ({ published, paused, label, className }) => {
    expect(availabilityBadge({ published, paused })).toEqual({ label, className });
  });

  it('pausado gana sobre publicado', () => {
    // Si esta precedencia se invierte, el CMS muestra "Publicado" para algo que el
    // runtime está rechazando.
    expect(availabilityBadge({ published: true, paused: true }).label).toBe('Pausado');
  });
});
