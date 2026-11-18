import type { ReactNode } from 'react'
import type { Department } from '../api/departments'
import type { ManagerOption } from '../api/employees'
import type { EmployeeFormValues, RequiredField } from './employeeValidation'

export type FieldErrors = Partial<Record<RequiredField, string>>

type FieldProps = {
  name: keyof EmployeeFormValues
  label: string
  error?: string
  hint?: string
  children: (a: { id: string; className: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}

export const FIELD_IDS: Record<string, string> = {
  jobTitle: 'job-title',
  departmentId: 'department',
  managerId: 'manager',
  startDate: 'start-date',
  fullName: 'full-name',
  dateOfBirth: 'dob',
  workEmail: 'email',
  phone: 'phone',
}

function Field({ name, label, error, hint, children }: FieldProps) {
  const id = FIELD_IDS[name]
  const errorId = `${id}-err`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, className: '', ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}) })}
      {hint && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}

type Props = {
  mode: 'new' | 'edit'
  values: EmployeeFormValues
  errors: FieldErrors
  departments: Department[]
  managers: ManagerOption[]
  saving: boolean
  onChange: (patch: Partial<EmployeeFormValues>) => void
  onSubmit: () => void
  onCancel: () => void
  onEditContact: (index: number) => void
  onAddContact: () => void
}

export function EmployeeForm({ mode, values, errors, departments, managers, saving, onChange, onSubmit, onCancel, onEditContact, onAddContact }: Props) {
  const isNew = mode === 'new'
  const input = (name: keyof EmployeeFormValues, label: string, extra: { type?: string; placeholder?: string } = {}) => (
    <Field name={name} label={label} error={errors[name as RequiredField]}>
      {(a) => (
        <input
          {...a}
          className={errors[name as RequiredField] ? 'input is-invalid' : 'input'}
          type={extra.type}
          placeholder={isNew ? extra.placeholder : undefined}
          value={values[name] as string}
          onChange={(e) => onChange({ [name]: e.target.value })}
        />
      )}
    </Field>
  )
  const select = (name: 'departmentId' | 'managerId', label: string, placeholder: string, options: { id: string; name: string }[], hint?: string) => (
    <Field name={name} label={label} error={errors[name]} hint={hint}>
      {(a) => (
        <select {...a} className={errors[name] ? 'select is-invalid' : 'select'} value={values[name]} onChange={(e) => onChange({ [name]: e.target.value })}>
          {(isNew || !values[name]) && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
  const optional = isNew && <span className="badge badge-neutral">Optional</span>

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <section className="card">
        <h3 className="section-title">Job details</h3>
        <div className="grid grid-2">
          {input('jobTitle', 'Job title', { placeholder: 'For example, Product Designer' })}
          {select('departmentId', 'Department', 'Select a department', departments, 'Each employee belongs to exactly one department.')}
          {select('managerId', 'Manager', 'Select a manager', managers.map((m) => ({ id: m.id, name: m.fullName })))}
          {input('startDate', 'Start date', { type: 'date' })}
        </div>
      </section>
      <section className="card">
        <h3 className="section-title">Personal details</h3>
        <div className="grid grid-2">
          {input('fullName', 'Full name', { placeholder: 'Full legal name' })}
          {input('dateOfBirth', 'Date of birth', { type: 'date' })}
        </div>
      </section>
      <section className="card">
        <h3 className="section-title">Contact details {optional}</h3>
        <div className="grid grid-2">
          {input('workEmail', 'Work email', { type: 'email', placeholder: 'name@example.com' })}
          {input('phone', 'Phone', { type: 'tel', placeholder: '+44 7700 900000' })}
        </div>
      </section>
      <section className="card">
        <h3 className="section-title">Emergency contacts {optional}</h3>
        <div className="stack">
          {values.emergencyContacts.map((c, i) => (
            <div key={i} className="cluster-between">
              <span>{`${c.name}, ${c.relationship}, ${c.phone}`}</span>
              <button type="button" className="btn btn-secondary btn-sm" aria-label={`Edit emergency contact ${c.name}`} onClick={() => onEditContact(i)}>
                Edit
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-secondary" onClick={onAddContact}>
              Add emergency contact
            </button>
          </div>
        </div>
      </section>
      <div className="actions-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <span className="spinner" aria-hidden="true" />}
          {isNew ? 'Create employee' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
