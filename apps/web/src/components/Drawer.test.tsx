import { fireEvent, render, screen } from '@testing-library/react'
import { Drawer } from './Drawer'

describe('Drawer', () => {
  it('is a labelled dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Drawer title="Search results" onClose={onClose}>
        <button>Inside</button>
      </Drawer>,
    )
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Search results' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('wraps Tab from the last control to the first', () => {
    render(
      <Drawer title="T" onClose={vi.fn()}>
        <button>Inside</button>
      </Drawer>,
    )
    screen.getByRole('button', { name: 'Inside' }).focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('returns focus to the opener on unmount', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(
      <Drawer title="T" onClose={vi.fn()}>
        <p>x</p>
      </Drawer>,
    )
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
