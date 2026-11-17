import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  menuClient,
  type FieldErrors,
  type ItemInput,
  type Menu,
  type MenuClient,
  type MenuItem,
} from '../api/menu-client'
import ItemForm from './ItemForm'
import SectionCard from './SectionCard'
import SectionForm from './SectionForm'

type View =
  | { kind: 'list' }
  | { kind: 'section-form'; sectionId?: string; name: string }
  | { kind: 'item-form'; sectionId: string; item?: MenuItem }

interface Notice {
  tone: 'success' | 'danger'
  title: string
  text: string
}

interface Props {
  restaurantId: string
  client?: MenuClient
}

export default function ManageMenuPage({ restaurantId, client = menuClient }: Props) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [notice, setNotice] = useState<Notice | null>(null)

  const reload = useCallback(async () => {
    try {
      setMenu(await client.getMenu(restaurantId))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [client, restaurantId])

  useEffect(() => {
    void reload()
  }, [reload])

  const restaurantName = menu?.restaurant.name ?? ''

  function refused(): Notice {
    return {
      tone: 'danger',
      title: 'Change refused',
      text: `You are not a manager of this restaurant, so you can't add, edit or remove its menu sections or items. Ask a manager of ${restaurantName} to make the change.`,
    }
  }

  /** Runs a change, then returns to the list with a result banner. */
  async function change(action: () => Promise<void>, success: Notice, failure?: Notice) {
    try {
      await action()
      setNotice(success)
      setView({ kind: 'list' })
      await reload()
    } catch (err) {
      setView({ kind: 'list' })
      if (err instanceof ApiError && err.status === 403) setNotice(refused())
      else if (failure && err instanceof ApiError && err.status === 409) setNotice(failure)
      else
        setNotice({
          tone: 'danger',
          title: 'Change not saved',
          text: 'Something went wrong. Try again.',
        })
    }
  }

  async function saveItem(item: ItemInput): Promise<FieldErrors | void> {
    if (view.kind !== 'item-form') return
    const { sectionId, item: editing } = view
    try {
      if (editing) await client.updateItem(restaurantId, editing.id, item)
      else await client.addItem(restaurantId, sectionId, item)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) return err.fieldErrors
      setView({ kind: 'list' })
      setNotice(
        err instanceof ApiError && err.status === 403
          ? refused()
          : { tone: 'danger', title: 'Item not saved', text: 'Something went wrong. Try again.' },
      )
      return
    }
    setNotice({
      tone: 'success',
      title: 'Item saved',
      text: 'Customers see the saved name, description and price the next time they load the menu.',
    })
    setView({ kind: 'list' })
    await reload()
  }

  function openForm(next: View) {
    setNotice(null)
    setView(next)
  }

  if (loadFailed) {
    return (
      <div role="alert" className="alert alert-danger">
        <span className="alert-title">Menu not loaded</span>
        <span>Reload the page to try again.</span>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="stack" aria-busy="true">
        <div className="card section-card stack stack-sm">
          <span className="skeleton" style={{ width: '30%' }}></span>
          <span className="skeleton"></span>
          <span className="skeleton"></span>
        </div>
        <p className="text-sm text-muted" role="status">
          Loading your menu.
        </p>
      </div>
    )
  }

  const { currency } = menu.restaurant
  const addSection = () => openForm({ kind: 'section-form', name: '' })

  return (
    <div className="stack">
      <div className="cluster cluster-between">
        <div>
          <h1>Menu</h1>
          <p className="text-muted">
            {restaurantName}. Build your menu. Prices are shown in your restaurant's currency (
            {currency}) and include taxes.
          </p>
        </div>
        {menu.sections.length > 0 && view.kind === 'list' && (
          <button className="btn btn-primary" type="button" onClick={addSection}>
            Add menu section
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Customers see saved changes the next time they load the menu. Each price appears exactly as
        you enter it, in {currency}.
      </p>

      {notice && (
        <div
          className={`alert alert-${notice.tone}`}
          role={notice.tone === 'danger' ? 'alert' : 'status'}
        >
          <span className="alert-title">{notice.title}</span>
          <span>{notice.text}</span>
        </div>
      )}

      {view.kind === 'section-form' && (
        <SectionForm
          initialName={view.name}
          onCancel={() => setView({ kind: 'list' })}
          onSave={(name) =>
            change(
              () =>
                view.sectionId
                  ? client.renameSection(restaurantId, view.sectionId, name)
                  : client.addSection(restaurantId, name),
              {
                tone: 'success',
                title: 'Section saved',
                text: `${name} is on the menu.`,
              },
            )
          }
        />
      )}

      {view.kind === 'item-form' && (
        <ItemForm
          currency={currency}
          initial={{
            name: view.item?.name ?? '',
            description: view.item?.description ?? '',
            price: view.item?.price ?? '',
          }}
          onCancel={() => setView({ kind: 'list' })}
          onSave={saveItem}
        />
      )}

      {view.kind === 'list' && menu.sections.length === 0 && (
        <div className="empty-state">
          <h3>Your menu has no sections yet</h3>
          <p>Add a section such as Starters or Mains, then add items to it.</p>
          <button className="btn btn-primary" type="button" onClick={addSection}>
            Add menu section
          </button>
        </div>
      )}

      {view.kind === 'list' &&
        menu.sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            currency={currency}
            onRenameSection={() =>
              openForm({ kind: 'section-form', sectionId: section.id, name: section.name })
            }
            onRemoveSection={() => {
              setNotice(null)
              void change(
                () => client.removeSection(restaurantId, section.id),
                {
                  tone: 'success',
                  title: 'Section removed from the menu',
                  text: `${section.name} had no items, so it was removed.`,
                },
                {
                  tone: 'danger',
                  title: 'Section not removed',
                  text: 'This section still has items. Remove its items first, then remove the section.',
                },
              )
            }}
            onAddItem={() => openForm({ kind: 'item-form', sectionId: section.id })}
            onEditItem={(item) => openForm({ kind: 'item-form', sectionId: section.id, item })}
            onRemoveItem={(item) => {
              setNotice(null)
              void change(() => client.removeItem(restaurantId, item.id), {
                tone: 'success',
                title: 'Item removed from the menu',
                text: 'Customers no longer see it when they load the menu.',
              })
            }}
          />
        ))}
    </div>
  )
}
