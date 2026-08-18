import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export function notFound(message: string): never { throw new NotFoundException({ code: 'NOT_FOUND', message }); }
export function badRequest(message: string, details?: unknown): never { throw new BadRequestException({ code: 'VALIDATION_ERROR', message, details }); }
export function conflict(message: string): never { throw new ConflictException({ code: 'CONFLICT', message }); }
