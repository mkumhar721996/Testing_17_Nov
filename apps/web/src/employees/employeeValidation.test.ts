import { validateEmployeeForm, type EmployeeFormValues } from './employeeValidation'

const valid: EmployeeFormValues = {
  fullName: 'A B',
  jobTitle: 'Engineer',
  departmentId: 'd1',
  managerId: 'm1',
  startDate: '2026-03-02',
  dateOfBirth: '',
  workEmail: '',
  phone: '',
  emergencyContacts: [],
}

describe('validateEmployeeForm', () => {
  it('accepts the five required fields alone', () => {
    expect(validateEmployeeForm(valid)).toEqual({})
  })

  it.each(['fullName', 'jobTitle', 'departmentId', 'managerId', 'startDate'] as const)('requires %s', (field) => {
    const errors = validateEmployeeForm({ ...valid, [field]: '  ' })
    expect(Object.keys(errors)).toEqual([field])
  })

  it('words each error next to its field', () => {
    expect(validateEmployeeForm({ ...valid, departmentId: '' }).departmentId).toBe('Required. Choose a department.')
  })
})
