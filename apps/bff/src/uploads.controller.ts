import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { UploadsService } from './uploads.service';

const uploadInputSchema = z.object({
  fieldName: z.string().min(1),
  name: z.string().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size: z.number().int().positive(),
});

@Controller('runtime/forms')
export class UploadsController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @Post(':formId/uploads')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('formId') formId: string,
    @Headers('x-upload-session') sessionKey: string | undefined,
    @Body() body: unknown,
  ) {
    const input = uploadInputSchema.parse(body);
    return this.uploads.createUpload(formId, input.fieldName, input, sessionKey ?? '');
  }

  @Post(':formId/uploads/:uploadId/complete')
  complete(
    @Param('formId') formId: string,
    @Param('uploadId') uploadId: string,
    @Headers('x-upload-session') sessionKey: string | undefined,
  ) {
    return this.uploads.completeUpload(formId, uploadId, sessionKey ?? '');
  }
}
