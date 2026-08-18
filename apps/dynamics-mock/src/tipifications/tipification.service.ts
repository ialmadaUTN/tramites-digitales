import { submissionEnvelopeSchema, type SubmissionEnvelope } from '@tramites/form-contracts';
import type { FailurePolicy } from './failure-policy.js';

export type TipificationResult =
  | { status: 202; body: { accepted: true; externalId: string; receivedAt: string } }
  | { status: 400; body: { code: 'INVALID_ENVELOPE'; message: string; details: unknown } }
  | { status: 503; body: { code: 'MOCK_FAILURE'; message: string } };

export class TipificationService {
  constructor(
    private readonly failurePolicy: FailurePolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  accept(payload: unknown, headers: Record<string, string | string[] | undefined>): TipificationResult {
    const parsed = submissionEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      return { status: 400, body: { code: 'INVALID_ENVELOPE', message: 'Envelope inválido', details: parsed.error.flatten() } };
    }
    if (this.failurePolicy.shouldFail(headers)) {
      return { status: 503, body: { code: 'MOCK_FAILURE', message: 'Falla simulada del servicio externo' } };
    }
    return { status: 202, body: this.toAccepted(parsed.data) };
  }

  private toAccepted(envelope: SubmissionEnvelope) {
    return {
      accepted: true as const,
      externalId: `DYN-${envelope.submissionId.slice(0, 8).toUpperCase()}`,
      receivedAt: this.now().toISOString(),
    };
  }
}
