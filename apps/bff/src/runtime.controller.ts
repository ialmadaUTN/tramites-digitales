import { Controller, Get, Header, Inject, Param, Query } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller('runtime/forms')
export class RuntimeController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  // no-store: si la definición queda cacheada en el browser o en un CDN, un formulario
  // pausado se seguiría sirviendo después de la pausa.
  @Get(':formId')
  @Header('Cache-Control', 'no-store')
  runtime(@Param('formId') formId: string, @Query('mode') mode?: 'published' | 'draft') {
    return this.forms.runtime(formId, mode === 'draft' ? 'draft' : 'published');
  }
}
