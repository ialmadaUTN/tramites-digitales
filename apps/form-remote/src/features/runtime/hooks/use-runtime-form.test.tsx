// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formDefinitionSchema, type DynamicFormProps } from '@tramites/form-contracts';
import type { RuntimeApi } from '../api/runtime-api';
import { useRuntimeForm } from './use-runtime-form';

const definition = formDefinitionSchema.parse({
  schemaVersion: 3,
  tipificationKey: 'generic@v1',
  externalVariables: [{ name: 'insuranceCode', label: 'Código', type: 'string', trust: 'trusted' }],
  title: 'Runtime', submitLabel: 'Enviar',
  containers: [{ id: 'c1', title: 'Datos', kind: 'section', columns: 1, fields: [{ id: 'f1', fieldName: 'code', type: 'text', label: 'Código', rules: {} }] }],
});
function props(): DynamicFormProps {
  return { formId: '11111111-1111-4111-8111-111111111111', apiBaseUrl: 'http://localhost:3001', externalVariables: { insuranceCode: '2050' }, contextToken: 'signed' };
}

describe('useRuntimeForm', () => {
  it('carga la definición, expone variables externas y envía el token de contexto', async () => {
    const api: RuntimeApi = {
      loadForm: vi.fn(async () => ({ formId: props().formId, version: 1, definition, source: 'published' as const })),
      submit: vi.fn(async () => ({ submissionId: '22222222-2222-4222-8222-222222222222', formId: props().formId, formVersion: 1, deliveryStatus: 'delivered' as const, submittedAt: new Date().toISOString() })),
      createUpload: vi.fn(),
      completeUpload: vi.fn(),
    };
    const { result } = renderHook(() => useRuntimeForm(props(), () => api));
    await waitFor(() => expect(result.current.definition).toBeTruthy());
    expect(result.current.externalVariables).toEqual({ insuranceCode: '2050' });
    await act(async () => { await result.current.submit({ code: 'ok' }); });
    expect(api.submit).toHaveBeenCalledWith(props().formId, expect.objectContaining({ contextToken: 'signed' }), expect.any(String));
  });
});
