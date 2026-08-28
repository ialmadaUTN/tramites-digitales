export type MockEnv = {
  port: number;
  host: string;
  forceFailure: boolean;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): MockEnv {
  return {
    port: Number(source.PORT ?? source.MOCK_PORT ?? 3003),
    host: source.MOCK_HOST ?? (source.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1'),
    forceFailure: source.MOCK_FORCE_FAILURE === 'true',
  };
}
