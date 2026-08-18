export interface FailurePolicy {
  shouldFail(headers: Record<string, string | string[] | undefined>): boolean;
}

export function createHeaderOrEnvFailurePolicy(forceFailure: boolean): FailurePolicy {
  return {
    shouldFail(headers) {
      const header = headers['x-mock-failure'];
      const value = Array.isArray(header) ? header[0] : header;
      return value === 'true' || forceFailure;
    },
  };
}
