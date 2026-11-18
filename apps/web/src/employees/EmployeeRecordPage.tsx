import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { listDepartments, type Department } from '../api/departments'
import { createEmployee, getEmployee, listManagerOptions, updateEmployee, type EmployeeRecord, type ManagerOption } from '../api/employees'
import { Toast } from '../components/Toast'
import { EmergencyContactModal } from './EmergencyContactModal'
import { EmployeeForm, FIELD_IDS, type FieldErrors } from './EmployeeForm'
import { validateEmployeeForm, type EmployeeFormValues, type RequiredField } from './employeeValidation'

const BLANK: EmployeeFormValues = {
  fullName: '',
  jobTitle: '',
  departmentId: '',
  managerId: '',
  startDate: '',
  dateOfBirth: '',
  workEmail: '',
  phone: '',
  emergencyContacts: [],
}

const toValues = (r: EmployeeRecord): EmployeeFormValues => ({
  fullName: r.fullName,
  jobTitle: r.jobTitle,
  departmentId: r.department.id,
  managerId: r.manager?.id ?? '',
  startDate: r.startDate,
  dateOfBirth: r.dateOfBirth ?? '',
  workEmail: r.workEmail ?? '',
  phone: r.phone ?? '',
  emergencyContacts: r.emergencyContacts,
})

const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403

type Load = 'loading' | 'ready' | 'forbidden' | 'error'
type Props = { employeeId: string | 'new'; onManageDepartments: () => void; onSaved?: (employeeId: string) => void }

export function EmployeeRecordPage({ employeeId, onManageDepartments, onSaved }: Props) {
  const [load, setLoad] = useState<Load>('loading')
  const [record, setRecord] = useState<EmployeeRecord | null>(null)
  const [values, setValues] = useState<EmployeeFormValues>(BLANK)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<ManagerOption[]>([])
  const [saving, setSaving] = useState(false)
  const [contactEdit, setContactEdit] = useState<{ index: number | null } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    setLoad('loading')
    Promise.all([listDepartments(), listManagerOptions(), employeeId === 'new' ? null : getEmployee(employeeId)]).then(
      ([depts, mgrs, rec]) => {
        setDepartments(depts)
        setManagers(mgrs)
        setRecord(rec)
        setValues(rec ? toValues(rec) : BLANK)
        setErrors({})
        setLoad('ready')
      },
      (err) => setLoad(isForbidden(err) ? 'forbidden' : 'error'),
    )
  }, [employeeId])

  const isNew = record === null
  // A seeded top-of-org record has no manager and may stay that way.
  const mayLackManager = !isNew && record.manager === null

  function showErrors(next: FieldErrors) {
    setErrors(next)
    const first = (Object.keys(FIELD_IDS) as string[]).find((f) => next[f as RequiredField])
    if (first) document.getElementById(FIELD_IDS[first])?.focus()
  }

  async function submit() {
    const found = validateEmployeeForm(values)
    if (mayLackManager && !values.managerId) delete found.managerId
    if (Object.keys(found).length) {
      showErrors(found)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      if (isNew) {
        const created = await createEmployee(values)
        setRecord(created)
        setValues(toValues(created))
        onSaved?.(created.id)
        setToast(`${created.fullName} created. The record shows the new details.`)
      } else {
        const { managerId, ...rest } = values
        const saved = await updateEmployee(record.id, managerId ? values : rest)
        setRecord(saved)
        setValues(toValues(saved))
        setToast(`Changes saved. ${saved.fullName}'s record shows the new details.`)
      }
    } catch (err) {
      if (isForbidden(err)) setLoad('forbidden')
      else if (err instanceof ApiError && err.status === 422) {
        const fieldErrors = ((err.body as { fieldErrors?: Record<string, string> })?.fieldErrors ?? {}) as FieldErrors
        showErrors(Object.keys(fieldErrors).length ? fieldErrors : { fullName: 'Check this field.' })
      } else setToast('The record was not saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function saveContact(contact: EmployeeFormValues['emergencyContacts'][number]) {
    const list = [...values.emergencyContacts]
    if (contactEdit?.index == null) list.push(contact)
    else list[contactEdit.index] = contact
    setValues({ ...values, emergencyContacts: list })
    setContactEdit(null)
  }

  function cancel() {
    setValues(record ? toValues(record) : BLANK)
    setErrors({})
  }

  if (load === 'loading') {
    return (
      <div className="stack" aria-busy="true">
        <div className="card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-line" />
          ))}
        </div>
        <div className="card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-line" />
          ))}
        </div>
      </div>
    )
  }

  if (load === 'forbidden') {
    return (
      <div className="empty-state" role="alert">
        <h3>You can't edit this record</h3>
        <p>Only HR can create or edit employee records. Ask someone in HR to make the change.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setLoad('ready')}>
          Back to employee record
        </button>
      </div>
    )
  }

  if (load === 'error') {
    return (
      <div className="alert alert-danger" role="alert">
        <div className="alert-title">The employee record could not be loaded.</div>
        Reload the page or try again in a moment.
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="cluster-between">
        {isNew ? <h2 className="section-title">New employee record</h2> : <h1 className="page-title">{record.fullName}</h1>}
        <button type="button" className="btn btn-secondary" onClick={onManageDepartments}>
          Manage departments
        </button>
      </div>
      {isNew && <p className="lead">Name and job details are required. Contact details and emergency contacts can be added now or later.</p>}
      {Object.keys(errors).length > 0 && (
        <div className="alert alert-danger" role="alert">
          <div className="alert-title">The record was not saved.</div>
          Fill in every required field: name, job title, department, manager and start date.
        </div>
      )}
      <EmployeeForm
        mode={isNew ? 'new' : 'edit'}
        values={values}
        errors={errors}
        departments={departments}
        managers={managers}
        saving={saving}
        onChange={(patch) => setValues({ ...values, ...patch })}
        onSubmit={submit}
        onCancel={cancel}
        onAddContact={() => setContactEdit({ index: null })}
        onEditContact={(index) => setContactEdit({ index })}
      />
      {contactEdit && (
        <EmergencyContactModal
          initial={contactEdit.index == null ? null : values.emergencyContacts[contactEdit.index]}
          onSave={saveContact}
          onClose={() => setContactEdit(null)}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}
