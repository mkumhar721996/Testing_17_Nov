import { apiFetch, apiFetchBlob, ApiError } from './client'

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

  it('sends FormData as it is, leaving the content type to the browser', async () => {
    const fn = stubFetch(201, { uploaded: true })
    const form = new FormData()
    form.append('docType', 'id')
    await apiFetch('/employees/e1/documents', { method: 'POST', body: form })
    const [, init] = fn.mock.calls[0]
    expect(init.body).toBe(form)
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('fetches a file as a Blob and throws ApiError on failure', async () => {
    const blob = new Blob(['%PDF'])
    const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => blob })
    vi.stubGlobal('fetch', fn)
    expect(await apiFetchBlob('/employees/e1/documents/d1/content')).toBe(blob)
    expect(fn.mock.calls[0][0]).toBe('/api/employees/e1/documents/d1/content')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, blob: async () => blob }))
    await expect(apiFetchBlob('/x')).rejects.toMatchObject({ status: 403 })
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
