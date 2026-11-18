import { apiFetch } from './client'

export type Department = { id: string; name: string; employeeCount: number }

export const listDepartments = () => apiFetch<Department[]>('/departments')

export const addDepartment = (name: string) => apiFetch<Department>('/departments', { method: 'POST', body: { name } })

export const renameDepartment = (id: string, name: string) =>
  apiFetch<Department>(`/departments/${id}`, { method: 'PATCH', body: { name } })

export const removeDepartment = (id: string) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' })
