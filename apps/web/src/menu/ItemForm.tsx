import { useState, type FormEvent } from 'react'
import type { FieldErrors, ItemInput } from '../api/menu-client'
import { isValidPrice } from './price'

interface Props {
  currency: string
  initial: ItemInput
  /** Resolves with the server's field errors when the item was not saved. */
  onSave: (item: ItemInput) => Promise<FieldErrors | void>
  onCancel: () => void
}

const NAME_ERROR = 'Enter a name for the item.'
const PRICE_ERROR = 'Enter a price greater than zero, with at most two decimal places.'

export default function ItemForm({ currency, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: FieldErrors = {}
    if (!values.name.trim()) found.name = NAME_ERROR
    if (!isValidPrice(values.price)) found.price = PRICE_ERROR
    if (!found.name && !found.price) {
      const server = await onSave({ ...values, name: values.name.trim(), price: values.price.trim() })
      if (!server) return
      if (server.name) found.name = NAME_ERROR
      if (server.price) found.price = PRICE_ERROR
    }
    setErrors(found)
  }

  const set = (field: keyof ItemInput) => (e: { target: { value: string } }) =>
    setValues({ ...values, [field]: e.target.value })
  const count = Object.keys(errors).length

  return (
    <form className="card form-card stack" onSubmit={submit} noValidate>
      <h2>Menu item</h2>
      {count > 0 && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">Item not saved</span>
          <span>
            Fix the {count === 1 ? '1 field' : `${count} fields`} marked below, then save again.
            Nothing you typed was lost.
          </span>
        </div>
      )}
      <div className="field">
        <label htmlFor="item-name">Name</label>
        <input
          className={errors.name ? 'input is-invalid' : 'input'}
          id="item-name"
          value={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'item-name-msg' : undefined}
          onChange={set('name')}
        />
        {errors.name && (
          <span className="field-error" id="item-name-msg">
            {errors.name}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="item-description">Description (optional)</label>
        <textarea
          className="textarea"
          id="item-description"
          value={values.description}
          onChange={set('description')}
        />
      </div>
      <div className="field">
        <label htmlFor="item-price">Price in {currency} (includes taxes)</label>
        <input
          className={errors.price ? 'input is-invalid' : 'input'}
          id="item-price"
          value={values.price}
          inputMode="decimal"
          aria-invalid={errors.price ? true : undefined}
          aria-describedby={errors.price ? 'item-price-msg' : 'item-price-hint'}
          onChange={set('price')}
        />
        {errors.price ? (
          <span className="field-error" id="item-price-msg">
            {errors.price}
          </span>
        ) : (
          <span className="field-hint" id="item-price-hint">
            One fixed price. Enter an amount greater than zero with up to two decimal places, such
            as 0.01 or 7.50.
          </span>
        )}
      </div>
      <div className="cluster" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit">
          Save item
        </button>
      </div>
      <p className="text-sm text-muted">
        Sizes, extras and required choices are not available for menu items.
      </p>
    </form>
  )
}
