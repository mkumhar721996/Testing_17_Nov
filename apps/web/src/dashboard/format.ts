/** "▲ +0.8%" / "▼ −0.2%": the arrow and sign carry the direction so it is never colour-only. */
export function formatChange(changePct: number): string {
  const magnitude = `${Math.abs(changePct).toFixed(1)}%`
  return changePct < 0 ? `▼ −${magnitude}` : `▲ +${magnitude}`
}

export function changeBadgeClass(changePct: number): string {
  return changePct < 0 ? 'badge badge-danger' : 'badge badge-success'
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
