import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('mantiene los defaults locales', () => {
    expect(loadEnv({})).toEqual({ port: 3003, host: '127.0.0.1', forceFailure: false });
  });

  it('prioriza PORT y escucha en todas las interfaces en Render', () => {
    expect(loadEnv({ PORT: '10000', RENDER: 'true', MOCK_PORT: '3003' })).toEqual({
      port: 10000,
      host: '0.0.0.0',
      forceFailure: false,
    });
  });

  it('permite forzar la configuración del mock', () => {
    expect(loadEnv({ PORT: '4000', MOCK_HOST: '127.0.0.1', MOCK_FORCE_FAILURE: 'true' })).toEqual({
      port: 4000,
      host: '127.0.0.1',
      forceFailure: true,
    });
  });
});
