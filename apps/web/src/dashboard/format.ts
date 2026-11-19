/** '▲ +0.8%' for a rise, '▼ −0.2%' (real minus sign) for a fall, so the direction is never colour-only. */
export function formatChange(pct: number): string {
  const size = `${Math.abs(pct).toFixed(1)}%`
  return pct < 0 ? `▼ −${size}` : `▲ +${size}`
}

/** '9:15 AM' */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
