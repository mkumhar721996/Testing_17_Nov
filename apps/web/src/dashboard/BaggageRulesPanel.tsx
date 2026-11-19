export const BAGGAGE_RULES = [
  'One cabin bag up to 10 kg is included with every fare.',
  'Checked bags are up to 23 kg each and are added when you book.',
  'Liquids in hand luggage must be in containers of 100 ml or less.',
  'Sports and musical equipment must be declared at booking.',
]

export function BaggageRulesPanel() {
  return (
    <section className="card">
      <h2 className="section-title">Baggage and travel rules</h2>
      <ul className="rules">
        {BAGGAGE_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  )
}
