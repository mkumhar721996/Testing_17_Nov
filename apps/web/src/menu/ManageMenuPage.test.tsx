import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError, type Menu, type MenuClient } from '../api/menu-client'
import ManageMenuPage from './ManageMenuPage'

function fakeClient(initial: Menu, overrides: Partial<MenuClient> = {}) {
  let menu: Menu = structuredClone(initial)
  let nextId = 1
  const client: MenuClient = {
    getMenu: async () => structuredClone(menu),
    addSection: async (_r, name) => {
      menu.sections.push({ id: `s${nextId++}`, name, items: [] })
    },
    renameSection: async (_r, id, name) => {
      menu.sections.find((s) => s.id === id)!.name = name
    },
    removeSection: async (_r, id) => {
      const s = menu.sections.find((x) => x.id === id)!
      if (s.items.length) throw new ApiError(409)
      menu.sections = menu.sections.filter((x) => x.id !== id)
    },
    addItem: async (_r, sid, item) => {
      menu.sections.find((s) => s.id === sid)!.items.push({ id: `i${nextId++}`, ...item })
    },
    updateItem: async (_r, id, item) => {
      for (const s of menu.sections) {
        const found = s.items.find((i) => i.id === id)
        if (found) Object.assign(found, item)
      }
    },
    removeItem: async (_r, id) => {
      for (const s of menu.sections) s.items = s.items.filter((i) => i.id !== id)
    },
    ...overrides,
  }
  return client
}

const restaurant = { id: 'r1', name: 'Bistro Lumiere', currency: 'USD' }
const soup = { id: 'i0', name: 'Tomato soup', description: 'Slow-roasted tomatoes', price: '7.50' }
const withSoup: Menu = { restaurant, sections: [{ id: 's0', name: 'Starters', items: [soup] }] }
const empty: Menu = { restaurant, sections: [] }

async function renderPage(menu: Menu, overrides: Partial<MenuClient> = {}) {
  render(<ManageMenuPage restaurantId="r1" client={fakeClient(menu, overrides)} />)
  await waitFor(() => expect(screen.queryByText('Loading your menu.')).toBeNull())
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('ManageMenuPage', () => {
  it('shows a loading state, then the empty state with the restaurant and currency', async () => {
    render(<ManageMenuPage restaurantId="r1" client={fakeClient(empty)} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your menu.')
    expect(await screen.findByText('Your menu has no sections yet')).toBeInTheDocument()
    expect(screen.getByText(/Bistro Lumiere/)).toBeInTheDocument()
    expect(screen.getByText(/currency \(USD\) and include taxes/)).toBeInTheDocument()
  })

  it('AC1 adds a section', async () => {
    await renderPage(empty)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add menu section' })[0])
    type('Section name', 'Starters')
    click('Save section')
    expect(await screen.findByRole('heading', { name: 'Starters' })).toBeInTheDocument()
  })

  it('AC2 adds an item showing name, description and price; AC21 description optional', async () => {
    await renderPage({ restaurant, sections: [{ id: 's0', name: 'Starters', items: [] }] })
    click(/Add item/)
    type('Name', 'Tomato soup')
    type('Description (optional)', 'Slow-roasted tomatoes')
    type(/Price in USD/, '7.50')
    click('Save item')
    expect(await screen.findByText('Tomato soup')).toBeInTheDocument()
    expect(screen.getByText('Slow-roasted tomatoes')).toBeInTheDocument()
    expect(screen.getByText('$7.50')).toBeInTheDocument()

    click(/Add item/)
    type('Name', 'Bread')
    type(/Price in USD/, '3')
    click('Save item')
    expect(await screen.findByText('Bread')).toBeInTheDocument()
  })

  it('AC3 renames a section from a prefilled form', async () => {
    await renderPage(withSoup)
    click('Rename section')
    expect(screen.getByLabelText('Section name')).toHaveValue('Starters')
    type('Section name', 'Mains')
    click('Save section')
    expect(await screen.findByRole('heading', { name: 'Mains' })).toBeInTheDocument()
  })

  it('AC4 edits an item from the current values', async () => {
    await renderPage(withSoup)
    click(/^Edit/)
    expect(screen.getByLabelText('Name')).toHaveValue('Tomato soup')
    expect(screen.getByLabelText(/Price in USD/)).toHaveValue('7.50')
    type(/Price in USD/, '9.00')
    click('Save item')
    expect(await screen.findByText('$9.00')).toBeInTheDocument()
    expect(screen.getByText('Item saved')).toBeInTheDocument()
  })

  it('AC5 removes an item', async () => {
    await renderPage(withSoup)
    const row = screen.getByText('Tomato soup').closest('.menu-item') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /^Remove/ }))
    expect(await screen.findByText('Item removed from the menu')).toBeInTheDocument()
    expect(screen.queryByText('Tomato soup')).toBeNull()
  })

  it('AC6/AC18/AC19 shows field errors and keeps typed values; nothing is saved', async () => {
    const addItem = vi.fn()
    await renderPage(
      { restaurant, sections: [{ id: 's0', name: 'Starters', items: [] }] },
      { addItem },
    )
    click(/Add item/)
    type('Description (optional)', 'Keep me')
    type(/Price in USD/, '0.000')
    click('Save item')
    expect(await screen.findByText('Item not saved')).toBeInTheDocument()
    expect(screen.getByText('Enter a name for the item.')).toBeInTheDocument()
    expect(
      screen.getByText('Enter a price greater than zero, with at most two decimal places.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Price in USD/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Keep me')
    expect(addItem).not.toHaveBeenCalled()
  })

  it('AC7 flags a missing price', async () => {
    await renderPage({ restaurant, sections: [{ id: 's0', name: 'Starters', items: [] }] })
    click(/Add item/)
    type('Name', 'Soup')
    click('Save item')
    expect(await screen.findByText(/Enter a price greater than zero/)).toBeInTheDocument()
  })

  it('maps the server field errors onto the form', async () => {
    const addItem = async () => {
      throw new ApiError(400, { price: 'bad' })
    }
    await renderPage(
      { restaurant, sections: [{ id: 's0', name: 'Starters', items: [] }] },
      { addItem },
    )
    click(/Add item/)
    type('Name', 'Soup')
    type(/Price in USD/, '5.00')
    click('Save item')
    expect(await screen.findByText('Item not saved')).toBeInTheDocument()
    expect(screen.getByLabelText(/Price in USD/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC8 offers no sizes, extras or choices, and AC9 no import', async () => {
    await renderPage(withSoup)
    expect(screen.queryByRole('button', { name: /import/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /import/i })).toBeNull()
    click(/^Edit/)
    expect(
      screen.getByText('Sizes, extras and required choices are not available for menu items.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/size|extra|choice/i, { selector: 'label, legend, button' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /import/i })).toBeNull()
  })

  it('AC10/11 shows "Change refused" on a 403', async () => {
    await renderPage(empty, {
      addSection: async () => {
        throw new ApiError(403)
      },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add menu section' })[0])
    type('Section name', 'Starters')
    click('Save section')
    expect(await screen.findByText('Change refused')).toBeInTheDocument()
    expect(screen.getByText(/Ask a manager of Bistro Lumiere/)).toBeInTheDocument()
  })

  it('AC12 shows every price in the API currency', async () => {
    const items = ['1.00', '2.00', '3.00'].map((price, n) => ({
      id: `i${n}`,
      name: `Dish ${n}`,
      description: '',
      price,
    }))
    await renderPage({
      restaurant: { ...restaurant, currency: 'EUR' },
      sections: [{ id: 's0', name: 'Starters', items }],
    })
    expect(screen.getAllByText(/€/)).toHaveLength(3)
  })

  it('AC16 explains why a section with items is not removed', async () => {
    await renderPage(withSoup)
    click('Remove section')
    expect(await screen.findByText('Section not removed')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This section still has items. Remove its items first, then remove the section.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Starters' })).toBeInTheDocument()
  })

  it('AC17 removes an empty section and then shows the empty state', async () => {
    await renderPage({ restaurant, sections: [{ id: 's0', name: 'Desserts', items: [] }] })
    expect(screen.getByText(/No items yet/)).toBeInTheDocument()
    click('Remove section')
    expect(await screen.findByText('Section removed from the menu')).toBeInTheDocument()
    expect(screen.getByText('Your menu has no sections yet')).toBeInTheDocument()
  })
})
