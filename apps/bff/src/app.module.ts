import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FormsController } from './forms.controller';
import { RuntimeController } from './runtime.controller';
import { SubmissionsController } from './submissions.controller';
import { FormsService } from './forms.service';
import { SubmissionsService } from './submissions.service';
import { SupabaseService } from './supabase.service';
import { DynamicsClient } from './dynamics.client';
import { TipificationRegistry } from './tipification.registry';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env.local', '../../.env', '.env'] })],
  controllers: [FormsController, RuntimeController, SubmissionsController, UploadsController],
  providers: [SupabaseService, FormsService, SubmissionsService, DynamicsClient, TipificationRegistry, UploadsService],
})
export class AppModule {}
