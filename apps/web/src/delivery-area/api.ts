import { getAccessToken } from '../auth/session'

export interface DeliveryArea {
  address: string
  deliveryRadiusKm: number | null
  measuredFrom: 'straight-line'
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed with status ${status}`)
  }
}

const baseUrl = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new ApiError(response.status)
  return response.json()
}

const areaPath = (restaurantId: string) =>
  `/restaurants/${encodeURIComponent(restaurantId)}/delivery-area`

export function getDeliveryArea(restaurantId: string): Promise<DeliveryArea> {
  return request(areaPath(restaurantId))
}

export function saveDeliveryRadius(
  restaurantId: string,
  km: number,
): Promise<{ deliveryRadiusKm: number }> {
  return request(areaPath(restaurantId), {
    method: 'PUT',
    body: JSON.stringify({ deliveryRadiusKm: km }),
  })
}
