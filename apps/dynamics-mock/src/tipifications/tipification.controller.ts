import type { Request, Response } from 'express';
import type { TipificationService } from './tipification.service.js';

export function createTipificationHandler(service: TipificationService) {
  return (request: Request, response: Response): void => {
    const result = service.accept(request.body, request.headers);
    response.status(result.status).json(result.body);
  };
}
