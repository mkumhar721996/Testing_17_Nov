import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import DeliveryAreaPage from './DeliveryAreaPage'

const ADDRESS = '14 Quay Street, Bristol BS1 4RB'

let radius: number | null
let putStatus: number
let fetchMock: ReturnType<typeof vi.fn>

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  radius = 5
  putStatus = 200
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (putStatus === 200) {
        radius = JSON.parse(init.body as string).deliveryRadiusKm
        return json(200, { deliveryRadiusKm: radius })
      }
      return json(putStatus, { message: 'no' })
    }
    return json(200, { address: ADDRESS, deliveryRadiusKm: radius, measuredFrom: 'straight-line' })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

async function open() {
  render(<DeliveryAreaPage restaurantId="r1" />)
  return screen.findByRole('heading', { name: 'Delivery area' })
}

async function save(value: string) {
  const field = await screen.findByLabelText('Delivery radius in km')
  fireEvent.change(field, { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save delivery radius' }))
}

describe('DeliveryAreaPage', () => {
  it('shows a loading state first', () => {
    render(<DeliveryAreaPage restaurantId="r1" />)
    expect(screen.getByText('Loading your delivery radius.')).toBeInTheDocument()
  })

  it('AC1/3/5: shows the saved radius measured in a straight line, and the pickup note', async () => {
    await open()
    expect(await screen.findByText('5 km')).toBeInTheDocument()
    expect(screen.getByText('Delivery on')).toBeInTheDocument()
    expect(screen.getByText(/Straight-line distance from 14 Quay Street/)).toBeInTheDocument()
    expect(screen.getByText(/Pickup is not affected/)).toBeInTheDocument()
  })

  it('sends the bearer-protected request to the restaurant delivery-area route', async () => {
    await open()
    await screen.findByText('5 km')
    expect(fetchMock.mock.calls[0][0]).toContain('/restaurants/r1/delivery-area')
  })

  it('AC6: not-set state shows delivery off', async () => {
    radius = null
    await open()
    expect(await screen.findByText('No delivery radius set')).toBeInTheDocument()
    expect(screen.getByText('Delivery off')).toBeInTheDocument()
    expect(screen.getByLabelText('Delivery radius in km')).toHaveValue('')
  })

  it('AC1/2: saving shows only the new value', async () => {
    await open()
    await save('8')
    expect(await screen.findByText('8 km')).toBeInTheDocument()
    expect(screen.getByText('Delivery radius saved')).toBeInTheDocument()
    expect(screen.queryByText('5 km')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body)).toEqual({ deliveryRadiusKm: 8 })
  })

  it.each(['0', '51', '2.5', ''])('AC7/8/11: %j shows the field error and is not sent', async (value) => {
    await open()
    await save(value)
    expect(await screen.findByRole('alert')).toHaveTextContent('Delivery radius not saved')
    expect(screen.getByLabelText('Delivery radius in km')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Enter a whole number from 1 to 50/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it.each(['1', '50'])('AC9/10: %s is saved', async (value) => {
    await open()
    await save(value)
    expect(await screen.findByText(`${value} km`)).toBeInTheDocument()
  })

  it('shows the invalid state when the API answers 400', async () => {
    putStatus = 400
    await open()
    await save('7')
    expect(await screen.findByRole('alert')).toHaveTextContent('Delivery radius not saved')
  })

  it('AC4: a 403 shows the change refused state', async () => {
    putStatus = 403
    await open()
    await save('7')
    expect(await screen.findByRole('alert')).toHaveTextContent('Change refused')
    fireEvent.click(screen.getByRole('button', { name: 'Back to delivery area' }))
    await waitFor(() => expect(screen.getByLabelText('Delivery radius in km')).toBeInTheDocument())
  })

  it('lets the manager change the radius again after saving', async () => {
    await open()
    await save('8')
    fireEvent.click(await screen.findByRole('button', { name: 'Change delivery radius' }))
    expect(await screen.findByLabelText('Delivery radius in km')).toHaveValue('8')
  })
})
