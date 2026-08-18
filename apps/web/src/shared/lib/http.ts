export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  return text || fallback;
}

export async function readOkJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readErrorMessage(response, fallback));
  return response.json() as Promise<T>;
}

export async function ensureOk(response: Response, fallback: string): Promise<void> {
  if (!response.ok) throw new Error(await readErrorMessage(response, fallback));
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
