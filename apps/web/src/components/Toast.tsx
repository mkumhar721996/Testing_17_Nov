import { useEffect } from 'react'

const AUTO_HIDE_MS = 5000

/** Confirmation of a completed action; hides itself after a few seconds. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <div className="toast is-open" role="status">
      {message}
    </div>
  )
}
