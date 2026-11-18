import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../api/client'
import * as api from '../api/departments'
import { DepartmentsPage } from './DepartmentsPage'

vi.mock('../api/departments')
const mocked = vi.mocked(api)

const eng = { id: 'eng', name: 'Engineering', employeeCount: 14 }
const res = { id: 'res', name: 'Research', employeeCount: 0 }

beforeEach(() => {
  vi.resetAllMocks()
  mocked.listDepartments.mockResolvedValue([eng, res])
})

const row = (name: string) => screen.getByText(name, { selector: 'strong' }).closest('li') as HTMLElement

describe('DepartmentsPage', () => {
  it('shows a loading state, then each department with its employee count', async () => {
    render(<DepartmentsPage />)
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText('14 employees')).toBeInTheDocument()
    expect(screen.getByText('0 employees')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Departments' })).toBeInTheDocument()
  })

  it('uses the singular for one employee', async () => {
    mocked.listDepartments.mockResolvedValue([{ id: 'd', name: 'Design', employeeCount: 1 }])
    render(<DepartmentsPage />)
    expect(await screen.findByText('1 employee')).toBeInTheDocument()
  })

  it('shows the empty state with a next step', async () => {
    mocked.listDepartments.mockResolvedValue([])
    render(<DepartmentsPage />)
    expect(await screen.findByText('No departments yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add department' })).toHaveLength(2)
  })

  it('shows the forbidden state on a 403 (AC7)', async () => {
    mocked.listDepartments.mockRejectedValue(new ApiError(403, {}))
    render(<DepartmentsPage />)
    expect(await screen.findByText("You can't change departments")).toBeInTheDocument()
  })

  it('adds a department, closes the modal and toasts (AC6)', async () => {
    mocked.addDepartment.mockResolvedValue({ id: 'legal', name: 'Legal', employeeCount: 0 })
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    fireEvent.click(screen.getByRole('button', { name: 'Add department' }))
    const dialog = screen.getByRole('dialog', { name: 'Add department' })
    fireEvent.change(within(dialog).getByLabelText('Department name'), { target: { value: 'Legal' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add department' }))
    expect(await screen.findByText('Legal added. It is now offered when choosing a department.')).toBeInTheDocument()
    expect(mocked.addDepartment).toHaveBeenCalledWith('Legal')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(row('Legal')).toBeInTheDocument()
  })

  it('refuses a blank name without calling the API', async () => {
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    fireEvent.click(screen.getByRole('button', { name: 'Add department' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add department' }))
    expect(await screen.findByText('Enter a department name.')).toBeInTheDocument()
    expect(mocked.addDepartment).not.toHaveBeenCalled()
  })

  it('shows the duplicate-name error on a 409', async () => {
    mocked.addDepartment.mockRejectedValue(new ApiError(409, {}))
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    fireEvent.click(screen.getByRole('button', { name: 'Add department' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Department name'), { target: { value: 'research' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add department' }))
    expect(await screen.findByText('research already exists. Use a different name.')).toBeInTheDocument()
  })

  it('renames and tells how many employees show the new name (AC10)', async () => {
    mocked.renameDepartment.mockResolvedValue({ ...eng, name: 'Platform' })
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    const r = row('Engineering')
    fireEvent.change(within(r).getByLabelText('Department name'), { target: { value: 'Platform' } })
    fireEvent.click(within(r).getByRole('button', { name: 'Save name' }))
    expect(await screen.findByText('Engineering renamed to Platform. 14 employees now show the new name.')).toBeInTheDocument()
    expect(mocked.renameDepartment).toHaveBeenCalledWith('eng', 'Platform')
    expect(row('Platform')).toBeInTheDocument()
  })

  it('blocks removing a department with employees without calling the API (AC11)', async () => {
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    fireEvent.click(within(row('Engineering')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText("Engineering can't be removed")).toBeInTheDocument()
    expect(screen.getByText('14 employees are assigned to it. Move them to another department first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(mocked.removeDepartment).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to departments' }))
    expect(screen.getByText('Research', { selector: 'strong' })).toBeInTheDocument()
  })

  it('shows the blocked state when the API answers 409', async () => {
    mocked.listDepartments.mockResolvedValue([{ ...res, employeeCount: 0 }])
    mocked.removeDepartment.mockRejectedValue(new ApiError(409, { code: 'DEPARTMENT_HAS_EMPLOYEES' }))
    render(<DepartmentsPage />)
    await screen.findByText('0 employees')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove department' }))
    expect(await screen.findByText("Research can't be removed")).toBeInTheDocument()
  })

  it('removes an empty department after confirming and toasts (AC12)', async () => {
    mocked.removeDepartment.mockResolvedValue(undefined)
    render(<DepartmentsPage />)
    await screen.findByText('14 employees')
    fireEvent.click(within(row('Research')).getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove Research?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove department' }))
    expect(await screen.findByText('Research removed. It is no longer offered when choosing a department.')).toBeInTheDocument()
    expect(mocked.removeDepartment).toHaveBeenCalledWith('res')
    await waitFor(() => expect(screen.queryByText('Research', { selector: 'strong' })).not.toBeInTheDocument())
  })
})
