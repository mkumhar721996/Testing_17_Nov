import type { MenuItem, MenuSection } from '../api/menu-client'
import { formatPrice } from './price'

interface Props {
  section: MenuSection
  currency: string
  onRenameSection: () => void
  onRemoveSection: () => void
  onAddItem: () => void
  onEditItem: (item: MenuItem) => void
  onRemoveItem: (item: MenuItem) => void
}

export default function SectionCard({
  section,
  currency,
  onRenameSection,
  onRemoveSection,
  onAddItem,
  onEditItem,
  onRemoveItem,
}: Props) {
  return (
    <div className="card section-card">
      <div className="cluster cluster-between">
        <h2>{section.name}</h2>
        <div className="cluster">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onRenameSection}>
            Rename section
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onRemoveSection}>
            Remove section
          </button>
        </div>
      </div>
      {section.items.length === 0 && (
        <p className="text-muted menu-item">
          No items yet. Add the first item, or remove this empty section.
        </p>
      )}
      {section.items.map((item) => (
        <div className="menu-item" key={item.id}>
          <div className="menu-item-text">
            <strong>{item.name}</strong>
            {item.description && <p className="text-muted text-sm">{item.description}</p>}
          </div>
          <div className="menu-item-side">
            <span className="price">{formatPrice(item.price, currency)}</span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              aria-label={`Edit ${item.name}`}
              onClick={() => onEditItem(item)}
            >
              Edit
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => onRemoveItem(item)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <div className="menu-item">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onAddItem}>
          + Add item
        </button>
      </div>
    </div>
  )
}
