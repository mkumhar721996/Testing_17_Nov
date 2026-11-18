import { useState } from 'react'
import { DepartmentsPage } from './departments/DepartmentsPage'
import { EmployeeRecordPage } from './employees/EmployeeRecordPage'
import { AppShell } from './shell/AppShell'

type View = 'employee' | 'departments'

export default function App() {
  const [view, setView] = useState<View>('employee')
  // The employee being worked on survives a visit to Departments; a created record replaces 'new'.
  const [employeeId, setEmployeeId] = useState<string | 'new'>('new')

  return (
    <AppShell current="settings">
      {view === 'employee' ? (
        <EmployeeRecordPage
          employeeId={employeeId}
          onSaved={setEmployeeId}
          onManageDepartments={() => setView('departments')}
        />
      ) : (
        <DepartmentsPage onBack={() => setView('employee')} />
      )}
    </AppShell>
  )
}
