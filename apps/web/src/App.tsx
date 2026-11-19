import { useState } from 'react'
import { Toast } from './components/Toast'
import { DashboardPage } from './dashboard/DashboardPage'
import { SIGNED_IN_TRAVELLER } from './dashboard/signedInTraveller'
import { DepartmentsPage } from './departments/DepartmentsPage'
import { EmployeeRecordPage } from './employees/EmployeeRecordPage'
import { AppShell } from './shell/AppShell'

type View = 'dashboard' | 'employee' | 'departments'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  // The employee being worked on survives a visit to Departments; a created record replaces 'new'.
  const [employeeId, setEmployeeId] = useState<string | 'new'>('new')
  const [toast, setToast] = useState<string | null>(null)

  if (view === 'dashboard') {
    return (
      <>
        <DashboardPage
          traveller={SIGNED_IN_TRAVELLER}
          onNavigate={(id) => id === 'settings' && setView('employee')}
          onNewBooking={() => setToast('The booking flow opens here.')}
        />
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </>
    )
  }

  // Stopgap: the shared shell has no way back to the Dashboard, so Overview is caught here
  // until a broader navigation strategy is agreed.
  function backToDashboard(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('nav a')?.textContent === 'Overview') {
      e.preventDefault()
      setView('dashboard')
    }
  }

  return (
    <div onClick={backToDashboard}>
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
    </div>
  )
}
