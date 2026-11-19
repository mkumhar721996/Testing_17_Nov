import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

import * as departments from './api/departments'
import * as employees from './api/employees'

vi.mock('./api/departments', () => ({ listDepartments: vi.fn().mockResolvedValue([]) }))
vi.mock('./api/employees', () => ({
  listManagerOptions: vi.fn().mockResolvedValue([]),
  createEmployee: vi.fn(),
  getEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}))

const openSettings = () => fireEvent.click(screen.getByRole('link', { name: 'Settings' }))

describe('App', () => {
  it('lands on the Dashboard without a footer, and New booking shows a toast', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'New booking' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('contentinfo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'New booking' }))
    expect(await screen.findByRole('status')).toHaveTextContent('The booking flow opens here.')
  })

  it('goes to the shell screens from Settings and back with Overview', async () => {
    render(<App />)
    openSettings()
    expect(await screen.findByRole('contentinfo')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Overview' }))
    expect(await screen.findByRole('button', { name: 'New booking' })).toBeInTheDocument()
  })

  it('opens the new employee record inside the shell under Settings', async () => {
    render(<App />)
    openSettings()
    expect(await screen.findByRole('heading', { name: 'New employee record' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between the employee record and the departments screen', async () => {
    render(<App />)
    openSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Manage departments' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Departments' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to employee record' }))
    expect(await screen.findByRole('heading', { name: 'New employee record' })).toBeInTheDocument()
  })

  it('returns to the employee that was just created, not a blank form', async () => {
    const created = {
      id: 'e9',
      fullName: 'Priya Shah',
      dateOfBirth: null,
      workEmail: null,
      phone: null,
      jobTitle: 'Product Designer',
      startDate: '2026-03-02',
      department: { id: 'design', name: 'Design' },
      manager: { id: 'ana', fullName: 'Ana Costa' },
      emergencyContacts: [],
    }
    vi.mocked(departments.listDepartments).mockResolvedValue([{ id: 'design', name: 'Design', employeeCount: 1 }])
    vi.mocked(employees.listManagerOptions).mockResolvedValue([{ id: 'ana', fullName: 'Ana Costa' }])
    vi.mocked(employees.createEmployee).mockResolvedValue(created)
    vi.mocked(employees.getEmployee).mockResolvedValue(created)
    render(<App />)
    openSettings()
    await screen.findByRole('option', { name: 'Design' })
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
    type('Job title', 'Product Designer')
    type('Department', 'design')
    type('Manager', 'ana')
    type('Start date', '2026-03-02')
    type('Full name', 'Priya Shah')
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    await screen.findByRole('heading', { level: 1, name: 'Priya Shah' })
    fireEvent.click(screen.getByRole('button', { name: 'Manage departments' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back to employee record' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Shah' })).toBeInTheDocument()
    expect(employees.getEmployee).toHaveBeenCalledWith('e9')
  })
})
