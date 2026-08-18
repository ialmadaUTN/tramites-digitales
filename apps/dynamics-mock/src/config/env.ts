export type MockEnv = {
  port: number;
  host: string;
  forceFailure: boolean;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): MockEnv {
  return {
    port: Number(source.MOCK_PORT ?? 3003),
    host: source.MOCK_HOST ?? '127.0.0.1',
    forceFailure: source.MOCK_FORCE_FAILURE === 'true',
  };
}
