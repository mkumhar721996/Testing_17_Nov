export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`)
  }
}

const baseUrl = () => import.meta.env.VITE_API_BASE_URL ?? '/api'

// Sign-in is a separate story; until it exists there is no token to send.
export function getAccessToken(): string | null {
  return null
}

type Init = { method?: string; body?: unknown }

/** Calls the Operations API with JSON and the bearer token; throws ApiError on a non-2xx answer. */
export async function apiFetch<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}
