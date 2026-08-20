import { Injectable } from '@nestjs/common';
import type { FormDefinition, FormValue } from '@tramites/form-contracts';

export type TipificationData = Record<string, FormValue>;

export type TipificationMapper = (input: {
  formId: string;
  definition: FormDefinition;
  data: TipificationData;
}) => TipificationData;

type MapperRegistration = {
  version: string;
  mapper: TipificationMapper;
  supportsAttachments: boolean;
};

@Injectable()
export class TipificationRegistry {
  private readonly mappers = new Map<string, Map<string, MapperRegistration>>();
  private readonly defaults = new Map<string, string>();

  constructor() {
    this.register('generic', ({ data }) => data, { version: 'v1', supportsAttachments: true });
  }

  has(key: string): boolean {
    return Boolean(this.resolve(key));
  }

  supportsAttachments(definition: FormDefinition): boolean {
    const key = definition.tipificationKey ?? 'generic';
    return this.resolve(key)?.supportsAttachments ?? false;
  }

  assertAvailable(definition: FormDefinition): void {
    if (definition.schemaVersion !== 2) return;
    const key = definition.tipificationKey;
    if (!key || !this.has(key)) throw new Error(`No existe un mapper de tipificación registrado para ${key ?? '(vacío)'}`);
  }

  map(key: string, input: { formId: string; definition: FormDefinition; data: TipificationData }): TipificationData {
    const registration = this.resolve(key);
    if (!registration) throw new Error(`No existe un mapper de tipificación registrado para ${key}`);
    return registration.mapper(input);
  }

  register(key: string, mapper: TipificationMapper, options: { version?: string; supportsAttachments?: boolean } = {}): void {
    if (!key.trim()) throw new Error('La clave de tipificación es obligatoria');
    const version = options.version ?? 'v1';
    const versions = this.mappers.get(key) ?? new Map<string, MapperRegistration>();
    versions.set(version, { version, mapper, supportsAttachments: options.supportsAttachments ?? false });
    this.mappers.set(key, versions);
    this.defaults.set(key, version);
  }

  private resolve(key: string): MapperRegistration | undefined {
    const separator = key.lastIndexOf('@');
    const baseKey = separator > 0 ? key.slice(0, separator) : key;
    const requestedVersion = separator > 0 ? key.slice(separator + 1) : this.defaults.get(baseKey);
    if (!requestedVersion) return undefined;
    return this.mappers.get(baseKey)?.get(requestedVersion);
  }
}
