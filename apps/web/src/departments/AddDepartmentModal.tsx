import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { Modal } from '../components/Modal'

type Props = { onAdd: (name: string) => Promise<void>; onClose: () => void }

export function AddDepartmentModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const errorId = useId()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a department name.')
      return
    }
    setSaving(true)
    try {
      await onAdd(trimmed)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? `${trimmed} already exists. Use a different name.`
          : 'The department was not added. Try again.',
      )
      setSaving(false)
    }
  }

  return (
    <Modal title="Add department" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="new-dept-name">Department name</label>
          <input
            id="new-dept-name"
            className={error ? 'input is-invalid' : 'input'}
            value={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
          {error && (
            <span id={errorId} className="field-error" role="alert">
              {error}
            </span>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            Add department
          </button>
        </div>
      </form>
    </Modal>
  )
}
