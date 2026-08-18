import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { SubmissionsService } from './submissions.service';

const submitSchema = z.object({ version: z.number().int().positive(), payload: z.record(z.string(), z.unknown()) });

@Controller()
export class SubmissionsController {
  constructor(@Inject(SubmissionsService) private readonly submissions: SubmissionsService) {}

  @Post('runtime/forms/:formId/submissions')
  @HttpCode(HttpStatus.CREATED)
  submit(@Param('formId') formId: string, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() body: unknown) {
    const input = submitSchema.parse(body);
    return this.submissions.submit(formId, input.version, input.payload, idempotencyKey ?? '');
  }

  @Post('submissions/:submissionId/delivery/retry')
  retry(@Param('submissionId') submissionId: string) { return this.submissions.retry(submissionId); }
}
