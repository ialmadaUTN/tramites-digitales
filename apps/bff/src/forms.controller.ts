import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { FormsService } from './forms.service';

const formInputSchema = z.object({ name: z.string().min(1).max(120), definition: z.unknown() });
const draftInputSchema = z.object({ name: z.string().min(1).max(120).optional(), definition: z.unknown() });

@Controller('forms')
export class FormsController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  @Get()
  list() { return this.forms.list(); }

  @Post()
  create(@Body() body: unknown) {
    const input = formInputSchema.parse(body);
    return this.forms.create(input);
  }

  @Get(':formId/draft')
  draft(@Param('formId') formId: string) { return this.forms.getDraft(formId); }

  @Put(':formId/draft')
  updateDraft(@Param('formId') formId: string, @Body() body: unknown) {
    const input = draftInputSchema.parse(body);
    return this.forms.updateDraft(formId, input);
  }

  @Post(':formId/publish')
  publish(@Param('formId') formId: string) { return this.forms.publish(formId); }

  @Post(':formId/pause')
  pause(@Param('formId') formId: string) { return this.forms.pause(formId); }

  @Post(':formId/resume')
  resume(@Param('formId') formId: string) { return this.forms.resume(formId); }

  @Get(':formId/versions')
  versions(@Param('formId') formId: string) { return this.forms.versions(formId); }
}
