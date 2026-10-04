/** Browser-side JSON fetch that surfaces the server's friendly error message. */

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ClientApiError("You seem to be offline. Please check your connection.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ClientApiError(data?.error ?? "Something went wrong. Please try again.", res.status, data?.code);
  }
  return data as T;
}
