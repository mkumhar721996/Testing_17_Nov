import { useCallback, useEffect, useState } from 'react'
import { addDepartment, listDepartments, removeDepartment, renameDepartment, type Department } from '../api/departments'
import { ApiError } from '../api/client'
import { Modal } from '../components/Modal'
import { Toast } from '../components/Toast'
import { AddDepartmentModal } from './AddDepartmentModal'

const employees = (n: number) => `${n} ${n === 1 ? 'employee' : 'employees'}`

type Load = { status: 'loading' } | { status: 'forbidden' } | { status: 'error' } | { status: 'ready'; items: Department[] }

export function DepartmentsPage({ onBack }: { onBack?: () => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [adding, setAdding] = useState(false)
  const [confirming, setConfirming] = useState<Department | null>(null)
  const [blocked, setBlocked] = useState<Department | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    listDepartments().then(
      (items) => setLoad({ status: 'ready', items }),
      (err) => setLoad({ status: err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error' }),
    )
  }, [])

  const items = load.status === 'ready' ? load.items : []
  const setItems = (next: Department[]) => setLoad({ status: 'ready', items: next })

  async function add(name: string) {
    const created = await addDepartment(name)
    setItems([...items, created])
    setAdding(false)
    setToast(`${created.name} added. It is now offered when choosing a department.`)
  }

  async function rename(d: Department) {
    const name = (names[d.id] ?? d.name).trim()
    if (!name || name === d.name) return
    try {
      const updated = await renameDepartment(d.id, name)
      setItems(items.map((x) => (x.id === d.id ? { ...x, name: updated.name } : x)))
      setNames((n) => ({ ...n, [d.id]: updated.name }))
      setToast(`${d.name} renamed to ${updated.name}. ${employees(d.employeeCount)} now ${d.employeeCount === 1 ? 'shows' : 'show'} the new name.`)
    } catch (err) {
      setToast(err instanceof ApiError && err.status === 409 ? `${name} already exists. Use a different name.` : 'The name was not saved. Try again.')
    }
  }

  function requestRemove(d: Department) {
    if (d.employeeCount > 0) setBlocked(d)
    else setConfirming(d)
  }

  async function confirmRemove(d: Department) {
    setConfirming(null)
    try {
      await removeDepartment(d.id)
      setItems(items.filter((x) => x.id !== d.id))
      setToast(`${d.name} removed. It is no longer offered when choosing a department.`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBlocked(d)
      else setToast('The department was not removed. Try again.')
    }
  }

  let body
  if (load.status === 'loading') {
    body = (
      <div className="card" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skeleton-line" />
        ))}
      </div>
    )
  } else if (load.status === 'forbidden') {
    body = (
      <div className="empty-state" role="alert">
        <h3>You can't change departments</h3>
        <p>Only HR can add or change departments. Ask someone in HR to make the change.</p>
      </div>
    )
  } else if (load.status === 'error') {
    body = (
      <div className="alert alert-danger" role="alert">
        <div className="alert-title">Departments could not be loaded.</div>
        Reload the page or try again in a moment.
      </div>
    )
  } else if (blocked) {
    body = (
      <div className="stack">
        <div className="alert alert-warning" role="alert">
          <div className="alert-title">{blocked.name} can't be removed</div>
          <span id="blocked-text">
            {blocked.employeeCount > 0 ? employees(blocked.employeeCount) : 'Employees'}{' '}
            {blocked.employeeCount === 1 ? 'is' : 'are'} assigned to it. Move them to another department first.
          </span>
        </div>
        <ul className="row-list">
          <li className="cluster cluster-between">
            <div className="dept-name">
              <strong>{blocked.name}</strong> <span className="badge badge-neutral">{employees(blocked.employeeCount)}</span>
            </div>
            <button type="button" className="btn btn-danger" disabled aria-describedby="blocked-text">
              Remove
            </button>
          </li>
        </ul>
        <div>
          <button type="button" className="btn btn-secondary" onClick={() => setBlocked(null)}>
            Back to departments
          </button>
        </div>
      </div>
    )
  } else if (items.length === 0) {
    body = (
      <div className="empty-state">
        <h3>No departments yet</h3>
        <p>Add a department so it can be chosen on employee records.</p>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          Add department
        </button>
      </div>
    )
  } else {
    body = (
      <ul className="row-list">
        {items.map((d) => (
          <li key={d.id} className="cluster cluster-between">
            <div className="dept-name">
              <strong>{d.name}</strong> <span className="badge badge-neutral">{employees(d.employeeCount)}</span>
            </div>
            <div className="cluster dept-edit">
              <div className="field">
                <label htmlFor={`rename-${d.id}`}>Department name</label>
                <input
                  id={`rename-${d.id}`}
                  className="input"
                  value={names[d.id] ?? d.name}
                  onChange={(e) => setNames((n) => ({ ...n, [d.id]: e.target.value }))}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => rename(d)}>
                Save name
              </button>
              <button type="button" className="btn btn-danger" onClick={() => requestRemove(d)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="stack">
      <div className="cluster-between">
        <h1 className="page-title">Departments</h1>
        <div className="cluster">
          {onBack && (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Back to employee record
            </button>
          )}
          {load.status !== 'forbidden' && load.status !== 'loading' && load.status !== 'error' && !blocked && (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              Add department
            </button>
          )}
        </div>
      </div>
      <p className="lead">The department list is flat. Each employee belongs to exactly one department.</p>
      {body}
      {adding && <AddDepartmentModal onAdd={add} onClose={() => setAdding(false)} />}
      {confirming && (
        <Modal title={`Remove ${confirming.name}?`} onClose={() => setConfirming(null)}>
          <p>{confirming.name} will no longer be offered when choosing a department. This cannot be undone.</p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => confirmRemove(confirming)}>
              Remove department
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}
