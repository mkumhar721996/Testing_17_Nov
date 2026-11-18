import { useState, type FormEvent } from 'react'
import type { EmergencyContact } from '../api/employees'
import { Modal } from '../components/Modal'

type Props = { initial: EmergencyContact | null; onSave: (contact: EmergencyContact) => void; onClose: () => void }

export function EmergencyContactModal({ initial, onSave, onClose }: Props) {
  const [contact, setContact] = useState<EmergencyContact>(initial ?? { name: '', relationship: '', phone: '' })
  const [invalid, setInvalid] = useState(false)
  const set = (key: keyof EmergencyContact) => (e: { target: { value: string } }) => setContact({ ...contact, [key]: e.target.value })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!contact.name.trim() || !contact.relationship.trim() || !contact.phone.trim()) {
      setInvalid(true)
      return
    }
    onSave({ name: contact.name.trim(), relationship: contact.relationship.trim(), phone: contact.phone.trim() })
  }

  return (
    <Modal title="Emergency contact" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        {invalid && (
          <span className="field-error" role="alert">
            Enter the contact name, relationship and phone.
          </span>
        )}
        <div className="field">
          <label htmlFor="c-name">Contact name</label>
          <input id="c-name" className="input" value={contact.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="c-rel">Relationship</label>
          <input id="c-rel" className="input" placeholder="For example, spouse" value={contact.relationship} onChange={set('relationship')} />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone</label>
          <input id="c-phone" className="input" type="tel" value={contact.phone} onChange={set('phone')} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save contact
          </button>
        </div>
      </form>
    </Modal>
  )
}
