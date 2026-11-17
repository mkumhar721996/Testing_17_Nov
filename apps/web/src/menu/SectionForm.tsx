import { useState, type FormEvent } from 'react'

interface Props {
  initialName: string
  onSave: (name: string) => Promise<void>
  onCancel: () => void
}

export default function SectionForm({ initialName, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const [invalid, setInvalid] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setInvalid(true)
      return
    }
    await onSave(name.trim())
  }

  return (
    <form className="card form-card stack" onSubmit={submit} noValidate>
      <h2>Menu section</h2>
      <div className="field">
        <label htmlFor="section-name">Section name</label>
        <input
          className={invalid ? 'input is-invalid' : 'input'}
          id="section-name"
          value={name}
          maxLength={60}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'section-name-msg' : 'section-name-hint'}
          onChange={(e) => setName(e.target.value)}
        />
        {invalid ? (
          <span className="field-error" id="section-name-msg">
            Enter a name for the section.
          </span>
        ) : (
          <span className="field-hint" id="section-name-hint">
            Customers see this name above its items.
          </span>
        )}
      </div>
      <div className="cluster" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit">
          Save section
        </button>
      </div>
    </form>
  )
}
