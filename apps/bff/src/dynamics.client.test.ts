import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamicsClient } from './dynamics.client';

const envelope = { submissionId: '11111111-1111-4111-8111-111111111111', formId: '22222222-2222-4222-8222-222222222222', formVersion: 1, submittedAt: '2026-08-13T00:00:00.000Z', data: { name: 'Ana' } };

describe('DynamicsClient', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('delivers the envelope and parses the external response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 202 })));
    const result = await new DynamicsClient().deliver(envelope);
    expect(result).toEqual({ status: 'delivered', response: { accepted: true } });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('turns external failures into retryable failed deliveries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'MOCK_FAILURE' }), { status: 503 })));
    const result = await new DynamicsClient().deliver(envelope);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('503');
  });
});
