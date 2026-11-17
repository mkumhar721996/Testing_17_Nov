import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ApiError, type DeliveryArea, getDeliveryArea, saveDeliveryRadius } from './api'
import { validateRadius } from './validate'

type View = 'form' | 'invalid' | 'saved' | 'refused' | 'load-failed'

export default function DeliveryAreaPage({ restaurantId }: { restaurantId: string }) {
  const [area, setArea] = useState<DeliveryArea | null>(null)
  const [view, setView] = useState<View>('form')
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const returning = useRef(false)

  // Each view is its own tree, so the focused control unmounts on a change; move focus to the new content.
  useEffect(() => {
    if (view === 'saved' || view === 'refused') noticeRef.current?.focus()
    else if (view === 'form' && returning.current) inputRef.current?.focus()
    returning.current = false
  }, [view])

  useEffect(() => {
    let current = true
    getDeliveryArea(restaurantId)
      .then((loaded) => {
        if (!current) return
        setArea(loaded)
        setInput(loaded.deliveryRadiusKm === null ? '' : String(loaded.deliveryRadiusKm))
      })
      .catch((error) => {
        if (current) setView(error instanceof ApiError && error.status === 403 ? 'refused' : 'load-failed')
      })
    return () => {
      current = false
    }
  }, [restaurantId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const check = validateRadius(input)
    if (!check.ok) return setView('invalid')
    setSaving(true)
    try {
      const saved = await saveDeliveryRadius(restaurantId, check.km)
      setArea((previous) => previous && { ...previous, deliveryRadiusKm: saved.deliveryRadiusKm })
      setInput(String(saved.deliveryRadiusKm))
      setView('saved')
    } catch (error) {
      setView(error instanceof ApiError && error.status === 403 ? 'refused' : 'invalid')
    } finally {
      setSaving(false)
    }
  }

  function backToForm() {
    setInput(area?.deliveryRadiusKm == null ? '' : String(area.deliveryRadiusKm))
    returning.current = true
    setView('form')
  }

  const header = (
    <div>
      <h1>Delivery area</h1>
      <p className="text-muted">Set how far from your restaurant you deliver.</p>
    </div>
  )

  if (view === 'refused') {
    return (
      <div className="stack">
        {header}
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={noticeRef}>
          <span className="alert-title">Change refused</span>
          <span>
            You are not a manager of this restaurant, so you can't set or change its delivery
            radius. Ask a manager of this restaurant to make the change.
          </span>
        </div>
        <div>
          <button className="btn btn-secondary" type="button" onClick={backToForm}>
            Back to delivery area
          </button>
        </div>
      </div>
    )
  }

  if (view === 'load-failed') {
    return (
      <div className="stack">
        {header}
        <div className="alert alert-danger" role="alert">
          <span className="alert-title">Delivery area not loaded</span>
          <span>Reload the page to try again.</span>
        </div>
      </div>
    )
  }

  if (!area) {
    return (
      <div className="stack" aria-busy="true">
        {header}
        <div className="card form-card stack">
          <span className="skeleton" style={{ width: '40%' }} />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
        <p className="text-sm text-muted" role="status">
          Loading your delivery radius.
        </p>
      </div>
    )
  }

  const radius = area.deliveryRadiusKm
  const deliveryOn = radius !== null
  const addressCard = (
    <div className="card stack">
      <h2>Restaurant address</h2>
      <dl className="stack">
        <div className="detail-row">
          <dt>Address</dt>
          <dd>{area.address}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted">
        The operator set this address when adding the restaurant. Your delivery radius is measured
        from it.
      </p>
    </div>
  )
  const badge = (
    <span className={`badge ${deliveryOn ? 'badge-success' : 'badge-neutral'}`}>
      {deliveryOn ? 'Delivery on' : 'Delivery off'}
    </span>
  )

  if (view === 'saved') {
    return (
      <div className="stack">
        {header}
        {addressCard}
        <div className="alert alert-success" role="status" tabIndex={-1} ref={noticeRef}>
          <span className="alert-title">Delivery radius saved</span>
          <span>Your restaurant delivers within {radius} km. This replaces the previous radius.</span>
        </div>
        <div className="card form-card stack">
          <div className="cluster cluster-between">
            <h2>Delivery radius</h2>
            {badge}
          </div>
          <p>
            <span className="radius-value">{radius} km</span>
          </p>
          <p className="text-muted">Straight-line distance from {area.address}.</p>
        </div>
        <div>
          <button className="btn btn-secondary" type="button" onClick={backToForm}>
            Change delivery radius
          </button>
        </div>
      </div>
    )
  }

  const invalid = view === 'invalid'
  return (
    <div className="stack">
      {header}
      {addressCard}
      {!deliveryOn && !invalid && (
        <div className="alert alert-warning" role="status">
          <span className="alert-title">No delivery radius set</span>
          <span>
            Customers searching for delivery don't see this restaurant until you save a radius.
          </span>
        </div>
      )}
      <form className="card form-card stack" onSubmit={onSubmit} noValidate>
        <div className="cluster cluster-between">
          <h2>Delivery radius</h2>
          {badge}
        </div>
        {invalid && (
          <div role="alert" className="alert alert-danger">
            <span className="alert-title">Delivery radius not saved</span>
            <span>
              {deliveryOn ? `Your radius is still ${radius} km.` : 'Your radius is not set.'} Enter a
              whole number of kilometres from 1 to 50, then save again.
            </span>
          </div>
        )}
        {deliveryOn && !invalid && (
          <p>
            <span className="radius-value">{radius} km</span>
          </p>
        )}
        <p className="text-muted">
          Straight-line distance from {area.address}. It is not driving distance.
        </p>
        <div className="field">
          <label htmlFor="radius">Delivery radius in km</label>
          <div className="input-unit">
            <input
              className={`input${invalid ? ' is-invalid' : ''}`}
              id="radius"
              ref={inputRef}
              inputMode="numeric"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={invalid ? 'true' : undefined}
              aria-describedby={invalid ? 'radius-error' : 'radius-hint'}
            />
            <span aria-hidden="true">km</span>
          </div>
          {invalid ? (
            <span className="field-error" id="radius-error">
              Enter a whole number from 1 to 50. 0, 2.5 and 51 are not accepted.
            </span>
          ) : (
            <span className="field-hint" id="radius-hint">
              Whole kilometres from 1 to 50.
            </span>
          )}
        </div>
        <div className="cluster" style={{ justifyContent: 'flex-end' }}>
          {invalid && (
            <button className="btn btn-secondary" type="button" onClick={backToForm}>
              Cancel
            </button>
          )}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            Save delivery radius
          </button>
        </div>
        <p className="text-sm text-muted">
          Pickup is not affected. Customers can always choose pickup at this restaurant.
        </p>
      </form>
    </div>
  )
}
