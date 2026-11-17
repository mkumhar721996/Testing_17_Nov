import { getAccessToken } from './auth'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: string
}

export interface MenuSection {
  id: string
  name: string
  items: MenuItem[]
}

export interface Menu {
  restaurant: { id: string; name: string; currency: string }
  sections: MenuSection[]
}

export interface ItemInput {
  name: string
  description: string
  price: string
}

export interface FieldErrors {
  name?: string
  price?: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(`Request failed with status ${status}`)
  }
}

export interface MenuClient {
  getMenu(restaurantId: string): Promise<Menu>
  addSection(restaurantId: string, name: string): Promise<void>
  renameSection(restaurantId: string, sectionId: string, name: string): Promise<void>
  removeSection(restaurantId: string, sectionId: string): Promise<void>
  addItem(restaurantId: string, sectionId: string, item: ItemInput): Promise<void>
  updateItem(restaurantId: string, itemId: string, item: ItemInput): Promise<void>
  removeItem(restaurantId: string, itemId: string): Promise<void>
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getAccessToken()
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const json = res.status === 400 ? await res.json().catch(() => ({})) : {}
    throw new ApiError(res.status, json.errors)
  }
  return res
}

const menuPath = (restaurantId: string) => `/restaurants/${restaurantId}/menu`

export const menuClient: MenuClient = {
  async getMenu(restaurantId) {
    return (await request('GET', menuPath(restaurantId))).json()
  },
  async addSection(restaurantId, name) {
    await request('POST', `${menuPath(restaurantId)}/sections`, { name })
  },
  async renameSection(restaurantId, sectionId, name) {
    await request('PATCH', `${menuPath(restaurantId)}/sections/${sectionId}`, { name })
  },
  async removeSection(restaurantId, sectionId) {
    await request('DELETE', `${menuPath(restaurantId)}/sections/${sectionId}`)
  },
  async addItem(restaurantId, sectionId, item) {
    await request('POST', `${menuPath(restaurantId)}/sections/${sectionId}/items`, item)
  },
  async updateItem(restaurantId, itemId, item) {
    await request('PATCH', `${menuPath(restaurantId)}/items/${itemId}`, item)
  },
  async removeItem(restaurantId, itemId) {
    await request('DELETE', `${menuPath(restaurantId)}/items/${itemId}`)
  },
}
