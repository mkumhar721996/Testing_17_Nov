import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  return (
    <Modal title="Emergency contact" onClose={onClose}>
      <input aria-label="Contact name" />
      <button type="button">Save contact</button>
    </Modal>
  )
}

describe('Modal', () => {
  it('is a labelled modal dialog and focuses its first control', () => {
    render(<Harness />)
    expect(screen.getByRole('dialog', { name: 'Emergency contact' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Close')).toHaveFocus()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps Tab focus inside the dialog', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Save contact' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(screen.getByLabelText('Close')).toHaveFocus()
  })

  it('returns focus to the element that opened it', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(<Harness />)
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
