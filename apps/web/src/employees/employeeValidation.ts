import type { EmergencyContact } from '../api/employees'

export type EmployeeFormValues = {
  fullName: string
  jobTitle: string
  departmentId: string
  managerId: string
  startDate: string
  dateOfBirth: string
  workEmail: string
  phone: string
  emergencyContacts: EmergencyContact[]
}

export type RequiredField = 'jobTitle' | 'departmentId' | 'managerId' | 'startDate' | 'fullName'

/** Same required set as the API: name, job title, department, manager and start date. */
export const REQUIRED_MESSAGES: Record<RequiredField, string> = {
  jobTitle: 'Required. Enter the job title.',
  departmentId: 'Required. Choose a department.',
  managerId: 'Required. Choose a manager.',
  startDate: 'Required. Enter the start date.',
  fullName: "Required. Enter the employee's full name.",
}

export function validateEmployeeForm(values: EmployeeFormValues): Partial<Record<RequiredField, string>> {
  const errors: Partial<Record<RequiredField, string>> = {}
  for (const field of Object.keys(REQUIRED_MESSAGES) as RequiredField[]) {
    if (!values[field].trim()) errors[field] = REQUIRED_MESSAGES[field]
  }
  return errors
}
