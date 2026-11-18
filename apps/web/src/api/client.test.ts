import { apiFetch, ApiError } from './client'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('apiFetch', () => {
  it('prefixes /api, sends JSON and returns the parsed body', async () => {
    const fn = stubFetch(200, { ok: true })
    const out = await apiFetch('/departments', { method: 'POST', body: { name: 'Legal' } })
    expect(out).toEqual({ ok: true })
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('/api/departments')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Legal' }))
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('returns undefined for an empty response', async () => {
    stubFetch(204, undefined)
    expect(await apiFetch('/departments/1', { method: 'DELETE' })).toBeUndefined()
  })

  it('throws ApiError with status and body on failure', async () => {
    stubFetch(422, { fieldErrors: { jobTitle: 'Required.' } })
    await expect(apiFetch('/employees', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      body: { fieldErrors: { jobTitle: 'Required.' } },
    })
    stubFetch(403, {})
    await expect(apiFetch('/employees/1')).rejects.toBeInstanceOf(ApiError)
  })
})
