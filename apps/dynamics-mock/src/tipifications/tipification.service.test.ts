import { describe, expect, it } from 'vitest';
import { TipificationService } from './tipification.service.js';

const envelope = {
  submissionId: '11111111-1111-4111-8111-111111111111',
  formId: '22222222-2222-4222-8222-222222222222',
  formVersion: 1,
  submittedAt: '2026-08-13T00:00:00.000Z',
  data: { name: 'Ana' },
};

describe('TipificationService', () => {
  it('accepts a valid envelope', () => {
    const service = new TipificationService({ shouldFail: () => false }, () => new Date('2026-08-13T00:00:00.000Z'));
    expect(service.accept(envelope, {})).toEqual({
      status: 202,
      body: { accepted: true, externalId: 'DYN-11111111', receivedAt: '2026-08-13T00:00:00.000Z' },
    });
  });

  it('rejects an invalid envelope', () => {
    const service = new TipificationService({ shouldFail: () => false });
    const result = service.accept({ submissionId: 'bad' }, {});
    expect(result.status).toBe(400);
  });

  it('simulates an external failure when the policy says so', () => {
    const service = new TipificationService({ shouldFail: () => true });
    expect(service.accept(envelope, { 'x-mock-failure': 'true' }).status).toBe(503);
  });
});
