import { describe, expect, it } from 'vitest';
import { TipificationRegistry } from './tipification.registry';

const definition = {
  schemaVersion: 2 as const,
  tipificationKey: 'claims@v2',
  title: 'Claims',
  submitLabel: 'Enviar',
  containers: [],
};

describe('TipificationRegistry', () => {
  it('resolves an explicitly versioned mapper and its attachment capability', () => {
    const registry = new TipificationRegistry();
    registry.register('claims', ({ data }) => ({ ...data, mapped: 'v2' }), { version: 'v2', supportsAttachments: true });

    expect(registry.has('claims@v2')).toBe(true);
    expect(registry.supportsAttachments(definition)).toBe(true);
    expect(registry.map('claims@v2', { formId: 'form', definition, data: { value: 'ok' } })).toEqual({ value: 'ok', mapped: 'v2' });
  });

  it('does not silently resolve an unknown mapper version', () => {
    const registry = new TipificationRegistry();
    registry.register('claims', ({ data }) => data, { version: 'v1' });
    expect(registry.has('claims@v2')).toBe(false);
    expect(() => registry.map('claims@v2', { formId: 'form', definition, data: {} })).toThrow(/No existe/);
  });
});
