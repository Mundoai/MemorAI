const API_BASE_URL =
  process.env.MEMORAI_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";

const API_KEY = process.env.MEMORAI_API_KEY ?? "";

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  token?: string;
}

export async function apiRequest<T = unknown>(opts: RequestOptions): Promise<T> {
  const url = new URL(`${API_BASE_URL}${opts.path}`);

  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  } else if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const response = await fetch(url.toString(), {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
