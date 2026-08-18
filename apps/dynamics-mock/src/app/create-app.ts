import express, { type Express } from 'express';
import { getHealth } from '../health/health.controller.js';
import { createHeaderOrEnvFailurePolicy } from '../tipifications/failure-policy.js';
import { createTipificationHandler } from '../tipifications/tipification.controller.js';
import { TipificationService } from '../tipifications/tipification.service.js';

export function createApp(forceFailure = false): Express {
  const app = express();
  const tipifications = new TipificationService(createHeaderOrEnvFailurePolicy(forceFailure));
  app.use(express.json());
  app.get('/health', getHealth);
  app.post('/tipifications', createTipificationHandler(tipifications));
  return app;
}
