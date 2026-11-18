import { useState } from 'react'
import { DepartmentsPage } from './departments/DepartmentsPage'
import { EmployeeRecordPage } from './employees/EmployeeRecordPage'
import { AppShell } from './shell/AppShell'

type View = { view: 'employee'; employeeId: string | 'new' } | { view: 'departments' }

export default function App() {
  const [state, setState] = useState<View>({ view: 'employee', employeeId: 'new' })

  return (
    <AppShell current="settings">
      {state.view === 'employee' ? (
        <EmployeeRecordPage
          key={state.employeeId}
          employeeId={state.employeeId}
          onManageDepartments={() => setState({ view: 'departments' })}
        />
      ) : (
        <DepartmentsPage onBack={() => setState({ view: 'employee', employeeId: 'new' })} />
      )}
    </AppShell>
  )
}
