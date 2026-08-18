import type { Request, Response } from 'express';

export function getHealth(_request: Request, response: Response): void {
  response.json({ ok: true, service: 'dynamics-mock' });
}
