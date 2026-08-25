import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Mensaje único para formularios pausados. El front lo muestra tal cual; no lo dupliques como literal. */
export const FORM_PAUSED_MESSAGE = 'Este formulario no está disponible en este momento';

export function notFound(message: string): never { throw new NotFoundException({ code: 'NOT_FOUND', message }); }
export function badRequest(message: string, details?: unknown): never { throw new BadRequestException({ code: 'VALIDATION_ERROR', message, details }); }
export function conflict(message: string): never { throw new ConflictException({ code: 'CONFLICT', message }); }

/**
 * 409 y no 503: la pausa es un conflicto de estado de un recurso puntual, no una caída del servicio.
 * Un 503 haría que balanceadores y monitoreo lo lean como incidente y lo reintenten solos.
 */
export function formPaused(): never { throw new ConflictException({ code: 'FORM_PAUSED', message: FORM_PAUSED_MESSAGE }); }
