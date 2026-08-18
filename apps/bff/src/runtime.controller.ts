import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller('runtime/forms')
export class RuntimeController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  @Get(':formId')
  runtime(@Param('formId') formId: string, @Query('mode') mode?: 'published' | 'draft') {
    return this.forms.runtime(formId, mode === 'draft' ? 'draft' : 'published');
  }
}
