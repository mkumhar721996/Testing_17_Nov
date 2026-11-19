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

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Calls the Operations API with JSON and the bearer token; throws ApiError on a non-2xx answer.
 * A FormData body is sent as it is, so the browser sets the multipart content type and boundary.
 */
export async function apiFetch<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const multipart = init.body instanceof FormData
  const headers: Record<string, string> = { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...authHeaders() }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : multipart ? (init.body as FormData) : JSON.stringify(init.body),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

/** Fetches a file with the bearer token (a plain link cannot send it); throws ApiError on a non-2xx answer. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${baseUrl()}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new ApiError(res.status, undefined)
  return res.blob()
}
