import { apiFetch } from './client'

export type EmergencyContact = { name: string; relationship: string; phone: string }

export type EmployeeRecord = {
  id: string
  fullName: string
  dateOfBirth: string | null
  workEmail: string | null
  phone: string | null
  jobTitle: string
  startDate: string
  department: { id: string; name: string }
  manager: { id: string; fullName: string } | null
  emergencyContacts: EmergencyContact[]
}

export type EmployeeInput = {
  fullName: string
  jobTitle: string
  departmentId: string
  managerId: string
  startDate: string
  dateOfBirth?: string | null
  workEmail?: string | null
  phone?: string | null
  emergencyContacts?: EmergencyContact[]
}

export type ManagerOption = { id: string; fullName: string }

export const listManagerOptions = () => apiFetch<ManagerOption[]>('/employees/options')

export const getEmployee = (id: string) => apiFetch<EmployeeRecord>(`/employees/${id}`)

export const createEmployee = (input: EmployeeInput) => apiFetch<EmployeeRecord>('/employees', { method: 'POST', body: input })

export const updateEmployee = (id: string, input: Partial<EmployeeInput>) =>
  apiFetch<EmployeeRecord>(`/employees/${id}`, { method: 'PATCH', body: input })
