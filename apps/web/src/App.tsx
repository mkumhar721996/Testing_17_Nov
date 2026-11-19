import { useState } from 'react'
import { Dashboard } from './dashboard/Dashboard'
import { DepartmentsPage } from './departments/DepartmentsPage'
import { EmployeeRecordPage } from './employees/EmployeeRecordPage'
import { AppShell, type SectionId } from './shell/AppShell'

type View = 'employee' | 'departments'

export default function App() {
  const [section, setSection] = useState<SectionId>('overview')
  const [view, setView] = useState<View>('employee')
  // The employee being worked on survives a visit to Departments; a created record replaces 'new'.
  const [employeeId, setEmployeeId] = useState<string | 'new'>('new')

  return (
    <AppShell current={section} onNavigate={setSection}>
      {section === 'overview' && <Dashboard />}
      {section === 'settings' &&
        (view === 'employee' ? (
          <EmployeeRecordPage
            employeeId={employeeId}
            onSaved={setEmployeeId}
            onManageDepartments={() => setView('departments')}
          />
        ) : (
          <DepartmentsPage onBack={() => setView('employee')} />
        ))}
    </AppShell>
  )
}
