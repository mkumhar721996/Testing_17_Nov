import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../api/client'
import * as departments from '../api/departments'
import * as employees from '../api/employees'
import { EmployeeRecordPage } from './EmployeeRecordPage'

import * as documentsApi from '../api/documents'

vi.mock('../api/documents')
vi.mock('../api/departments')
vi.mock('../api/employees')
const emp = vi.mocked(employees)
const dept = vi.mocked(departments)

const record: employees.EmployeeRecord = {
  id: 'e1',
  fullName: 'Priya Shah',
  dateOfBirth: '1990-07-14',
  workEmail: 'priya.shah@example.com',
  phone: '+44 7700 900123',
  jobTitle: 'Senior Engineer',
  startDate: '2026-03-02',
  department: { id: 'eng', name: 'Engineering' },
  manager: { id: 'ana', fullName: 'Ana Costa' },
  emergencyContacts: [{ name: 'Raj Shah', relationship: 'Spouse', phone: '+44 7700 900456' }],
}

beforeEach(() => {
  vi.resetAllMocks()
  dept.listDepartments.mockResolvedValue([
    { id: 'eng', name: 'Engineering', employeeCount: 14 },
    { id: 'design', name: 'Design', employeeCount: 3 },
  ])
  emp.listManagerOptions.mockResolvedValue([
    { id: 'ana', fullName: 'Ana Costa' },
    { id: 'dev', fullName: 'Dev Patel' },
  ])
  emp.getEmployee.mockResolvedValue(record)
})

const props = { onManageDepartments: () => {} }
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function fillNewForm() {
  render(<EmployeeRecordPage employeeId="new" {...props} />)
  await screen.findByRole('option', { name: 'Design' })
  type('Job title', 'Product Designer')
  type('Department', 'design')
  type('Manager', 'ana')
  type('Start date', '2026-03-02')
  type('Full name', 'Priya Shah')
}

describe('EmployeeRecordPage: existing record', () => {
  it('shows loading, then the saved record (AC5 hint, one department)', async () => {
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Shah' })).toBeInTheDocument()
    expect(screen.getByLabelText('Job title')).toHaveValue('Senior Engineer')
    expect(screen.getByLabelText('Department')).toHaveValue('eng')
    expect(screen.getAllByRole('option').filter((o) => o.closest('select')?.id.includes('department')).map((o) => o.textContent)).toEqual([
      'Engineering',
      'Design',
    ])
    expect(screen.getByText('Each employee belongs to exactly one department.')).toBeInTheDocument()
    expect(screen.getByText('Raj Shah, Spouse, +44 7700 900456')).toBeInTheDocument()
  })

  it('saves a changed job title and toasts (AC2)', async () => {
    emp.updateEmployee.mockResolvedValue({ ...record, jobTitle: 'Staff Engineer' })
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    await screen.findByRole('heading', { name: 'Priya Shah' })
    type('Job title', 'Staff Engineer')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText("Changes saved. Priya Shah's record shows the new details.")).toBeInTheDocument()
    expect(emp.updateEmployee).toHaveBeenCalledWith('e1', expect.objectContaining({ jobTitle: 'Staff Engineer', departmentId: 'eng', managerId: 'ana' }))
  })

  it('changes the department, manager and start date (AC2, AC5)', async () => {
    emp.updateEmployee.mockResolvedValue(record)
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    await screen.findByRole('heading', { name: 'Priya Shah' })
    type('Department', 'design')
    type('Manager', 'dev')
    type('Start date', '2026-04-01')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(emp.updateEmployee).toHaveBeenCalled())
    expect(emp.updateEmployee).toHaveBeenCalledWith('e1', expect.objectContaining({ departmentId: 'design', managerId: 'dev', startDate: '2026-04-01' }))
  })

  it('edits an existing emergency contact through its Edit button (AC4)', async () => {
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    await screen.findByRole('heading', { name: 'Priya Shah' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit emergency contact Raj Shah' }))
    const dialog = screen.getByRole('dialog', { name: 'Emergency contact' })
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '+44 7700 900999' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save contact' }))
    expect(screen.getByText('Raj Shah, Spouse, +44 7700 900999')).toBeInTheDocument()
  })

  it('shows the forbidden state on a 403 (AC7)', async () => {
    emp.getEmployee.mockRejectedValue(new ApiError(403, {}))
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    expect(await screen.findByText("You can't edit this record")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to employee record' })).toBeInTheDocument()
  })

  it('opens the departments screen from Manage departments', async () => {
    const onManage = vi.fn()
    render(<EmployeeRecordPage employeeId="e1" onManageDepartments={onManage} />)
    await screen.findByRole('heading', { name: 'Priya Shah' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage departments' }))
    expect(onManage).toHaveBeenCalled()
  })
})

describe('EmployeeRecordPage: new record', () => {
  it('creates a record with the four job details (AC1)', async () => {
    emp.createEmployee.mockResolvedValue({ ...record, id: 'new1' })
    await fillNewForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    await waitFor(() => expect(emp.createEmployee).toHaveBeenCalledTimes(1))
    expect(emp.createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ jobTitle: 'Product Designer', departmentId: 'design', managerId: 'ana', startDate: '2026-03-02' }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('creates with personal details, contact details and added emergency contacts (AC3)', async () => {
    emp.createEmployee.mockResolvedValue({ ...record, id: 'new1' })
    await fillNewForm()
    type('Date of birth', '1990-07-14')
    type('Work email', 'priya.shah@example.com')
    type('Phone', '+44 7700 900123')
    fireEvent.click(screen.getByRole('button', { name: 'Add emergency contact' }))
    const dialog = screen.getByRole('dialog', { name: 'Emergency contact' })
    fireEvent.change(within(dialog).getByLabelText('Contact name'), { target: { value: 'Raj Shah' } })
    fireEvent.change(within(dialog).getByLabelText('Relationship'), { target: { value: 'Spouse' } })
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '+44 7700 900456' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save contact' }))
    expect(screen.getByText('Raj Shah, Spouse, +44 7700 900456')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    await waitFor(() => expect(emp.createEmployee).toHaveBeenCalled())
    expect(emp.createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        dateOfBirth: '1990-07-14',
        workEmail: 'priya.shah@example.com',
        phone: '+44 7700 900123',
        emergencyContacts: [{ name: 'Raj Shah', relationship: 'Spouse', phone: '+44 7700 900456' }],
      }),
    )
  })

  it('blocks a blank form: alert, five invalid fields, nothing sent (AC8)', async () => {
    render(<EmployeeRecordPage employeeId="new" {...props} />)
    await screen.findByRole('option', { name: 'Design' })
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The record was not saved.')
    expect(alert).toHaveTextContent('Fill in every required field: name, job title, department, manager and start date.')
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(5)
    expect(screen.getByText('Required. Choose a department.')).toBeInTheDocument()
    expect(screen.getByLabelText('Job title')).toHaveFocus()
    expect(emp.createEmployee).not.toHaveBeenCalled()
  })

  it.each([
    ['Job title', ''],
    ['Department', ''],
    ['Manager', ''],
    ['Start date', ''],
    ['Full name', ''],
  ])('does not save when %s is missing (AC8)', async (label, value) => {
    await fillNewForm()
    type(label, value)
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    expect(await screen.findByText('The record was not saved.')).toBeInTheDocument()
    expect(emp.createEmployee).not.toHaveBeenCalled()
  })

  it('saves with only the required fields and no error alert (AC9)', async () => {
    emp.createEmployee.mockResolvedValue({ ...record, id: 'new1' })
    await fillNewForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    await waitFor(() => expect(emp.createEmployee).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('The record was not saved.')).not.toBeInTheDocument()
  })

  it('maps a 422 fieldErrors body onto the fields', async () => {
    emp.createEmployee.mockRejectedValue(new ApiError(422, { fieldErrors: { managerId: 'Choose a manager from the list.' } }))
    await fillNewForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    expect(await screen.findByText('Choose a manager from the list.')).toBeInTheDocument()
    expect(screen.getByLabelText('Manager')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the forbidden state when the API refuses the create (AC7)', async () => {
    emp.createEmployee.mockRejectedValue(new ApiError(403, {}))
    await fillNewForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    expect(await screen.findByText("You can't edit this record")).toBeInTheDocument()
  })

  it('has no tabs on a new record', async () => {
    render(<EmployeeRecordPage employeeId="new" {...props} />)
    await screen.findByRole('heading', { name: 'New employee record' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('marks contact details and emergency contacts optional', async () => {
    render(<EmployeeRecordPage employeeId="new" {...props} />)
    expect(await screen.findByRole('heading', { name: 'New employee record' })).toBeInTheDocument()
    expect(screen.getAllByText('Optional')).toHaveLength(2)
  })
})

describe('EmployeeRecordPage: existing record tabs', () => {
  it('shows Details by default and the documents panel on the Documents tab', async () => {
    vi.mocked(documentsApi.listDocuments).mockResolvedValue({ documents: [], canUpload: true })
    render(<EmployeeRecordPage employeeId="e1" {...props} />)
    expect(await screen.findByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }))
    expect(await screen.findByText('No documents on this record yet')).toBeInTheDocument()
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument()
    expect(documentsApi.listDocuments).toHaveBeenCalledWith('e1')
  })
})
