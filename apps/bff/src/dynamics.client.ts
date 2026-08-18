import { Injectable } from '@nestjs/common';
import { submissionEnvelopeSchema, SubmissionEnvelope } from '@tramites/form-contracts';

export type DeliveryResult = { status: 'delivered' | 'failed'; error?: string; response?: unknown };

@Injectable()
export class DynamicsClient {
  async deliver(input: SubmissionEnvelope): Promise<DeliveryResult> {
    const envelope = submissionEnvelopeSchema.parse(input);
    const timeout = Number(process.env.DELIVERY_TIMEOUT_MS ?? 3000);
    const url = `${process.env.DYNAMICS_MOCK_URL ?? 'http://localhost:3003'}/tipifications`;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope), signal: AbortSignal.timeout(timeout) });
      const text = await response.text();
      let body: unknown = text;
      try { body = text ? JSON.parse(text) : undefined; } catch { /* keep text */ }
      if (!response.ok) return { status: 'failed', error: `Mock Dynamics respondió ${response.status}`, response: body };
      return { status: 'delivered', response: body };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : 'Error desconocido de entrega' };
    }
  }
}
