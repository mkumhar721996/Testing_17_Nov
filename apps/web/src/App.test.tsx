import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./api/departments', () => ({ listDepartments: vi.fn().mockResolvedValue([]) }))
vi.mock('./api/employees', () => ({ listManagerOptions: vi.fn().mockResolvedValue([]) }))

describe('App', () => {
  it('opens the new employee record inside the shell under Settings', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'New employee record' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between the employee record and the departments screen', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manage departments' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Departments' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to employee record' }))
    expect(await screen.findByRole('heading', { name: 'New employee record' })).toBeInTheDocument()
  })
})
